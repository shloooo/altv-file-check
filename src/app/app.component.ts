import {Component, OnInit} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {NgIf} from "@angular/common";
import {HttpClient} from "@angular/common/http";
import JSZip from "jszip";
import {CollapsibleSpanComponent} from "./collapsible-span/collapsible-span.component";

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, NgIf, CollapsibleSpanComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {

    originalGameFiles: string[] | undefined = undefined;
    uploadDisabled: boolean = false;

    message = 'Select a file to have it checked. Either a game.txt or a report directly.';

    fileCheckOutput: string[] | undefined = undefined;

    // ERRORS
    errors: string[] = [];
    // ERRORS

    constructor(private http: HttpClient) {}

    async ngOnInit() {
        await this.loadFile();
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

        this.message = 'Loading file... (This may take a few seconds)';
        this.errors = [];
        if (input.files && input.files.length > 0) {
            const file = input.files[0];

            if (file.type === 'text/plain') {
                await this.processTextFile(file);
                this.message = `Done! 🤖`;
            } else if (file.name.endsWith('.zip')) {
                await this.processZipFile(file);
                this.message = `Done! 🤖`;
            } else {
                this.message = 'The selected file is not valid.';
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
                this.checkFiles(text);
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
            const gameFile = zipContent.file('game.txt');

            if (gameFile) {
                const text = await gameFile.async('text');
                if (this.isTextReadable(text)) {
                    await this.checkFiles(text);
                } else {
                    this.message = 'The selected ZIP file does not contain a readable game.txt file.';
                    this.fileCheckOutput = undefined;
                    this.errors = [];
                }
            } else {
                this.message = 'The ZIP file does not contain a game.txt file.';
                this.fileCheckOutput = undefined;
                this.errors = [];
            }
        } catch (error) {
            this.message = 'An error occurred while reading the ZIP file: ' + (error as Error).message;
            this.fileCheckOutput = undefined;
            this.errors = [];
        }
    }

    async checkFiles(text: string): Promise<void> {
        if (this.originalGameFiles == undefined) {
            alert('Could not access original game files')
            return;
        }

        this.message = 'Checking now files... (This may take a few seconds)';

        let fails = 0;
        const detailed = false;

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
            if (file.toLowerCase().includes('.egstore') || file.toLowerCase().includes('redistributables') || file.toLowerCase().includes('eossdk-win64-shipping')) continue;
            const hash = fileLine.split(';')[1]
            const o = this.originalGameFiles.find(x => x.startsWith(file));
            if (o == undefined || !o.includes(hash)) {
                fails++;
                if (detailed) {
                    console.log(`${file} has an invalid hash! (Should: ${(o != null ? o.split(';')[1] : undefined)} | Is: ${hash})`)
                } else {
                    console.log()
                }

                const tag = o == undefined ? 'FILE_UNKNOWN' : 'FILE_HASH_DOES_NOT_MATCH';
                if (!this.errors.includes(tag)) {
                    this.errors.push(tag);
                }
                output += `${file} (${tag})\n`
            }
        }

        if (output.length == 0) {
            this.fileCheckOutput = [];
            return;
        }
        this.fileCheckOutput = this.splitIntoLines(output);
    }

    async loadFile(): Promise<void> {
        try {
            const originalGameFiles = await this.http.get('game.txt', { responseType: 'text' }).toPromise();
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
            }
        } catch (error) {
            this.message = 'Could not load game.txt file: ' + (error as Error).message;
            this.uploadDisabled = true;
        }
    }
}
