import JSZip from "jszip";
import {HttpClient} from "@angular/common/http";

export class FileCheckApi {

    static originalGameFiles: string[] | undefined = undefined;
    private static originalProcesses: { name: string; error: string; }[] = [];
    private static originalClient: { name: string; error: string; }[] = [];
    private static uploadDisabled: boolean = false;
    private static checked: boolean = false;

    private static message = 'check.not-started';

    // game.txt check
    private static gameFileErrors: number = 0;
    private static gameFilesTotal: number = 0;
    private static gameFileCheckOutput: string[] | undefined = undefined;

    // processes.txt check
    private static processesChecked: boolean = false;
    private static processesChecked2: number = 0;
    private static processesFailed: number = 0;
    private static processesDetails: string[] = [];

    // client.log check
    private static clientChecked: boolean = false;
    private static clientFailed: number = 0;
    private static clientDetails: string[] = [];

    // ERRORS
    private static errors: string[] = [];
    // ERRORS

    static async init(http: HttpClient) {
        await this.loadRequiredFiles(http);
    }

    private static isTextReadable(text: string): boolean {
        return /^[\x00-\x7F]*$/.test(text);
    }

    private static splitIntoLines(text: string): string[] {
        return text.split(/\r?\n/);
    }

    private static async processTextFile(file: File): Promise<void> {
        const reader = new FileReader();

        reader.onload = async (e) => {
            const text = e.target?.result as string;

            if (this.originalGameFiles == undefined) {
                alert('Could not access original game files');
                return;
            }

            if (this.isTextReadable(text)) {
                if (file.name.toLowerCase() == 'game.txt') {
                    await this.checkGameFile(text)
                } else if (file.name.toLowerCase() == 'processes.txt') {
                    await this.checkProcessesFile(text)
                } else if (file.name.toLowerCase() == 'client.log') {
                    await this.checkClientFile(text)
                } else {
                    this.message = 'Invalid file action';
                }
            } else {
                this.message = 'The selected file has no readable text';
                this.gameFileCheckOutput = undefined;
                this.errors = [];
            }
            this.checked = true;
        };

        reader.onerror = () => {
            this.message = 'An error occurred while reading the text';
            this.gameFileCheckOutput = undefined;
            this.errors = [];
        };

        reader.readAsText(file);
    }

    private static async processZipFile(file: File): Promise<void> {
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
                        alert('The selected ZIP file does not contain a readable game.txt file.')
                        this.gameFileCheckOutput = undefined;
                        this.errors = [];
                    }
                } else {
                    this.message = 'The ZIP file does not contain a game.txt file.';
                    alert('The ZIP file does not contain a game.txt file.')
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
                        alert('The selected ZIP file does not contain a readable processes.txt file.')
                    }
                } else {
                    this.message = 'The ZIP file does not contain a processes.txt file.';
                    alert('The ZIP file does not contain a processes.txt file.')
                    this.gameFileCheckOutput = undefined;
                    this.errors = [];
                }
            }

            // client.log
            {
                const processes = zipContent.file('client.log');
                if (processes) {
                    const text = await processes.async('text');
                    if (this.isTextReadable(text)) {
                        await this.checkClientFile(text);
                    } else {
                        this.message = 'The selected ZIP file does not contain a readable client.log file.';
                        alert('The selected ZIP file does not contain a readable client.log file.')
                    }
                } else {
                    this.message = 'The ZIP file does not contain a client.log file.';
                    alert('The ZIP file does not contain a client.log file.')
                    this.gameFileCheckOutput = undefined;
                    this.errors = [];
                }
            }

            this.checked = true;
        } catch (error) {
            this.message = 'An error occurred while reading the ZIP file: ' + (error as Error).message;
            this.gameFileCheckOutput = undefined;
            this.errors = [];
        }
    }

    static async checkGameFile(text: string): Promise<void> {
        if (this.originalGameFiles == undefined) {
            alert('Could not access original game files')
            return;
        }

        if (!text.toLowerCase().includes('file;hash')) {
            this.gameFileCheckOutput = undefined;
            this.errors.push('NOT_EXTENDED_REPORT')
            return;
        }

        let output = '';
        let gameFileErrors = 0;
        const fileLines = this.splitIntoLines(text);
        for (let fileLine of fileLines) {
            if (fileLine.toLowerCase() == 'file;hash' || fileLine.length == 0) continue;
            const file = fileLine.split(';')[0]
            if (file.toLowerCase().includes('.egstore') || file.toLowerCase().includes('redistributables') || file.toLowerCase().includes('readme') || file.toLowerCase().includes('eossdk-win64-shipping')) continue;
            if (file.toLowerCase().includes('reshade')) {
                if (!this.errors.includes('RESHADE_DETECTED')) {
                    this.errors.push('RESHADE_DETECTED');
                }
                gameFileErrors++;
                continue;
            }
            if (file.toLowerCase().includes('enb')) {
                if (!this.errors.includes('ENB_DETECTED')) {
                    this.errors.push('ENB_DETECTED');
                }
                gameFileErrors++;
                continue;
            }
            const hash = fileLine.split(';')[1]
            const o = this.originalGameFiles.find(x => x.startsWith(file));
            if (o == undefined || !o.includes(hash)) {
                console.log(`${file} has an invalid hash! (Should: ${(o != null ? o.split(';')[1] : undefined)} | Is: ${hash})`)

                const tag = o == undefined ? 'FILE_UNKNOWN' : 'FILE_HASH_DOES_NOT_MATCH';
                if (!this.errors.includes(tag)) {
                    this.errors.push(tag);
                }
                output += `${file} (${tag})\n`
                gameFileErrors++;
            }
        }

        this.gameFileErrors = gameFileErrors;
        this.gameFilesTotal = fileLines.length;
        if (output.length == 0) {
            this.gameFileCheckOutput = [];
            return;
        }
        this.gameFileCheckOutput = this.splitIntoLines(output);
    }

    static async checkProcessesFile(text: string): Promise<void> {
        this.processesChecked = true;
        this.processesChecked2 = 0;
        this.processesFailed = 0;
        this.processesDetails = [];
        const fileLines = this.splitIntoLines(text);
        for (let fileLine of fileLines) {
            const error = this.originalProcesses.find(s => fileLine.toLowerCase().includes(s.name.toLowerCase()));
            this.processesChecked2++;
            if (error == undefined) continue;
            this.processesFailed++;
            if (!this.errors.includes(error.error)) {
                this.errors.push(error.error);
            }
            this.processesDetails.push(fileLine)
        }
    }

    static async checkClientFile(text: string): Promise<void> {
        this.clientChecked = true;
        this.clientFailed = 0;
        this.clientDetails = [];
        const fileLines = this.splitIntoLines(text);
        for (let fileLine of fileLines) {
            const error = this.originalClient.find(s => fileLine.toLowerCase().includes(s.name.toLowerCase()));
            if (error == undefined) continue;
            this.clientFailed++;
            if (!this.errors.includes(error.error)) {
                this.errors.push(error.error);
            }
            this.clientDetails.push(fileLine)
        }
    }

    static async loadRequiredFiles(http: HttpClient): Promise<void> {
        try {
            // game.txt
            {
                const originalGameFiles = await http.get('https://raw.githubusercontent.com/shloooo/altv-file-check/data-files/checks/game.txt', {responseType: 'text'}).toPromise();
                if (originalGameFiles == undefined) {
                    this.message = 'game.txt has no readable text';
                    this.gameFileCheckOutput = undefined;
                    this.errors = [];
                    this.uploadDisabled = true;
                    return;
                }

                if (this.isTextReadable(originalGameFiles)) {
                    this.originalGameFiles = this.splitIntoLines(originalGameFiles);
                } else {
                    this.message = 'game.txt has no readable text';
                    this.gameFileCheckOutput = undefined;
                    this.errors = [];
                    this.uploadDisabled = true;
                    return;
                }
            }

            // process.json
            {
                const originalProcesses = await http.get('https://raw.githubusercontent.com/shloooo/altv-file-check/data-files/checks/processes.json', {responseType: 'text'}).toPromise();
                if (originalProcesses == undefined) {
                    this.message = 'process.json has no readable text';
                    this.gameFileCheckOutput = undefined;
                    this.errors = [];
                    this.uploadDisabled = true;
                    return;
                }

                try {
                    this.originalProcesses = JSON.parse(originalProcesses)
                } catch (e) {
                    this.message = 'Could not load process.json';
                    this.gameFileCheckOutput = undefined;
                    this.errors = [];
                    this.uploadDisabled = true;
                    return;
                }
            }

            // client.json
            {
                const originalClient = await http.get('https://raw.githubusercontent.com/shloooo/altv-file-check/data-files/checks/client.json', {responseType: 'text'}).toPromise();
                if (originalClient == undefined) {
                    this.message = 'client.json has no readable text';
                    this.gameFileCheckOutput = undefined;
                    this.errors = [];
                    this.uploadDisabled = true;
                    return;
                }

                try {
                    this.originalClient = JSON.parse(originalClient)
                } catch (e) {
                    this.message = 'Could not load client.json';
                    this.gameFileCheckOutput = undefined;
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