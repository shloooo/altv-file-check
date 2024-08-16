import {Component, Inject, LOCALE_ID, OnInit} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {NgForOf, NgIf} from "@angular/common";
import {HttpClient} from "@angular/common/http";
import JSZip from "jszip";
import {CollapsibleSpanComponent} from "./collapsible-span/collapsible-span.component";
import {TranslateModule, TranslateService} from "@ngx-translate/core";
import {SafePipe} from "../@core/pipes/safe.pipe";

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, NgIf, CollapsibleSpanComponent, TranslateModule, NgForOf, SafePipe],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {

    originalGameFiles: string[] | undefined = undefined;
    originalProcesses: {name:string;error:string;}[] = [];
    uploadDisabled: boolean = false;

    message = 'check.not-started';

    // game.txt check
    filesTotal: number = 0;
    fileCheckOutput: string[] | undefined = undefined;

    // processes.txt check
    processesChecked: boolean = false;
    processesChecked2: number = 0;
    processesFailed: number = 0;

    // ERRORS
    errors: string[] = [];
    // ERRORS

    constructor(private http: HttpClient,
                private translate: TranslateService,
                @Inject(LOCALE_ID) public locale: string) {
        // Initialize the default language
        translate.setDefaultLang('en-US');
        translate.use(locale);

        // Debug language
        console.log(`Default lang: ${translate.defaultLang}`)
        console.log(`System lang: ${locale}`)
    }

    async ngOnInit() {
        await this.loadRequiredFiles();
    }

    async onFileSelected(event: Event): Promise<void> {
        if (this.uploadDisabled) {
            alert('Upload is disabled')
            return;
        }

        if (this.originalGameFiles == undefined) {
            alert('Could not access original game files')
            return;
        }

        const input = event.target as HTMLInputElement;

        this.message = 'check.in-progress';
        this.errors = [];
        this.processesChecked = false;
        if (input.files && input.files.length > 0) {
            const file = input.files[0];

            if (file.type === 'text/plain') {
                await this.processTextFile(file);
                this.message = `check.done`;
            } else if (file.name.endsWith('.zip')) {
                await this.processZipFile(file);
                this.message = `check.done`;
            } else {
                this.message = 'check.invalid-file';
                this.fileCheckOutput = undefined;
                this.errors = [];
            }
        }
    }

    private isTextReadable(text: string): boolean {
        return /^[\x00-\x7F]*$/.test(text);
    }

    private splitIntoLines(text: string): string[] {
        return text.split(/\r?\n/);
    }

    private async processTextFile(file: File): Promise<void> {
        const reader = new FileReader();

        reader.onload = (e) => {
            const text = e.target?.result as string;

            if (this.originalGameFiles == undefined) {
                alert('Could not access original game files');
                return;
            }

            if (this.isTextReadable(text)) {
                if (file.name.toLowerCase() == 'game.txt') {
                    this.checkGameFile(text);
                } else if (file.name.toLowerCase() == 'processes.txt') {
                    this.checkProcessesFile(text)
                } else {
                    this.message = 'Invalid .txt action';
                }
            } else {
                this.message = 'The selected file has no readable text';
                this.fileCheckOutput = undefined;
                this.errors = [];
            }
        };

        reader.onerror = () => {
            this.message = 'An error occurred while reading the text';
            this.fileCheckOutput = undefined;
            this.errors = [];
        };

        reader.readAsText(file);
    }

    private async processZipFile(file: File): Promise<void> {
        try {
            const zip = new JSZip();
            const zipContent = await zip.loadAsync(file);

            // game.txt
            {
                const gameFile = zipContent.file('game.txt');
                if (gameFile) {
                    const text = await gameFile.async('text');
                    if (this.isTextReadable(text)) {
                        await this.checkGameFile(text);
                    } else {
                        this.message = 'The selected ZIP file does not contain a readable game.txt file.';
                        this.fileCheckOutput = undefined;
                        this.errors = [];
                    }
                } else {
                    this.message = 'The ZIP file does not contain a game.txt file.';
                }
            }

            // processes.txt
            {
                const processes = zipContent.file('processes.txt');
                if (processes) {
                    const text = await processes.async('text');
                    if (this.isTextReadable(text)) {
                        await this.checkProcessesFile(text);
                    } else {
                        this.message = 'The selected ZIP file does not contain a readable processes.txt file.';
                    }
                } else {
                    this.message = 'The ZIP file does not contain a game.txt file.';
                    this.fileCheckOutput = undefined;
                    this.errors = [];
                }
            }
        } catch (error) {
            this.message = 'An error occurred while reading the ZIP file: ' + (error as Error).message;
            this.fileCheckOutput = undefined;
            this.errors = [];
        }
    }

    async checkGameFile(text: string): Promise<void> {
        if (this.originalGameFiles == undefined) {
            alert('Could not access original game files')
            return;
        }

        if (!text.toLowerCase().includes('file;hash')) {
            this.fileCheckOutput = undefined;
            this.errors.push('NOT_EXTENDED_REPORT')
            return;
        }

        let output = '';
        const fileLines = this.splitIntoLines(text);
        for (let fileLine of fileLines) {
            if (fileLine.toLowerCase() == 'file;hash' || fileLine.length == 0) continue;
            const file = fileLine.split(';')[0]
            if (file.toLowerCase().includes('.egstore') || file.toLowerCase().includes('redistributables') || file.toLowerCase().includes('readme') || file.toLowerCase().includes('eossdk-win64-shipping')) continue;
            const hash = fileLine.split(';')[1]
            const o = this.originalGameFiles.find(x => x.startsWith(file));
            if (o == undefined || !o.includes(hash)) {
                console.log(`${file} has an invalid hash! (Should: ${(o != null ? o.split(';')[1] : undefined)} | Is: ${hash})`)

                const tag = o == undefined ? 'FILE_UNKNOWN' : 'FILE_HASH_DOES_NOT_MATCH';
                if (!this.errors.includes(tag)) {
                    this.errors.push(tag);
                }
                output += `${file} (${tag})\n`
            }
        }

        this.filesTotal = fileLines.length;
        if (output.length == 0) {
            this.fileCheckOutput = [];
            return;
        }
        this.fileCheckOutput = this.splitIntoLines(output);
    }

    async checkProcessesFile(text: string): Promise<void> {
        this.processesChecked = true;
        this.processesChecked2 = 0;
        this.processesFailed = 0;
        const fileLines = this.splitIntoLines(text);
        for (let fileLine of fileLines) {
            const error = this.originalProcesses.find(s => fileLine.toLowerCase().includes(s.name.toLowerCase()));
            this.processesChecked2++;
            if (error == undefined) continue;
            this.processesFailed++;
            if (!this.errors.includes(error.error)) {
                this.errors.push(error.error);
            }
        }
    }

    async loadRequiredFiles(): Promise<void> {
        try {
            // game.txt
            {
                const originalGameFiles = await this.http.get('https://raw.githubusercontent.com/shloooo/altv-file-check/data-files/game.txt', {responseType: 'text'}).toPromise();
                if (originalGameFiles == undefined) {
                    this.message = 'game.txt has no readable text';
                    this.fileCheckOutput = undefined;
                    this.errors = [];
                    this.uploadDisabled = true;
                    return;
                }

                if (this.isTextReadable(originalGameFiles)) {
                    this.originalGameFiles = this.splitIntoLines(originalGameFiles);
                } else {
                    this.message = 'game.txt has no readable text';
                    this.fileCheckOutput = undefined;
                    this.errors = [];
                    this.uploadDisabled = true;
                    return;
                }
            }

            // process.json
            {
                const originalProcesses = await this.http.get('https://raw.githubusercontent.com/shloooo/altv-file-check/data-files/process.json', {responseType: 'text'}).toPromise();
                if (originalProcesses == undefined) {
                    this.message = 'process.json has no readable text';
                    this.fileCheckOutput = undefined;
                    this.errors = [];
                    this.uploadDisabled = true;
                    return;
                }

                try {
                    this.originalProcesses = JSON.parse(originalProcesses)
                } catch (e) {
                    this.message = 'Could not load process.json';
                    this.fileCheckOutput = undefined;
                    this.errors = [];
                    this.uploadDisabled = true;
                    return;
                }
            }
        } catch (error) {
            this.message = 'Could not load required files: ' + (error as Error).message;
            this.uploadDisabled = true;
        }
    }
}
