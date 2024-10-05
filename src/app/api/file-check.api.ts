import JSZip from "jszip";
import {HttpClient} from "@angular/common/http";

export class FileCheckApi {

    originalGameFiles: string[] | undefined = undefined;
    private originalProcesses: { name: string; warning: string; error: string; }[] = [];
    private originalClient: { name: string; warning: string; error: string; }[] = [];
    private uploadDisabled: boolean = false;
    private checked: boolean = false;

    private message = 'check.not-started';

    // game.txt check
    private gameFileErrors: number = 0;
    private gameFilesTotal: number = 0;
    private gameFileCheckOutput: string[] | undefined = undefined;

    // processes.txt check
    private processesChecked: boolean = false;
    private processesChecked2: number = 0;
    private processesFailed: number = 0;
    private processesDetails: string[] = [];

    // client.log check
    private clientChecked: boolean = false;
    private clientFailed: number = 0;
    private clientDetails: string[] = [];

    // ERRORS
    private warnings: string[] = [];
    private errors: string[] = [];
    // ERRORS

    async init(http: HttpClient) {
        await this.loadRequiredFiles(http);
    }

    private isTextReadable(text: string): boolean {
        return /^[\x00-\x7F]*$/.test(text);
    }

    private splitIntoLines(text: string): string[] {
        return text.split(/\r?\n/);
    }
    
    async processFile(file: File) {
        this.warnings = [];
        this.errors = [];
        this.processesChecked = false;
        this.clientChecked = false;

        if (file.type === 'text/plain') {
            await this.processTextFile(file);
            this.message = `check.done`;
        } else if (file.name.endsWith('.zip')) {
            await this.processZipFile(file);
            this.message = `check.done`;
        } else {
            this.message = 'check.invalid-file';
            this.gameFileCheckOutput = undefined;
            this.warnings = [];
            this.errors = [];
        }
        
        return this.result();
    }

    private async processTextFile(file: File): Promise<void> {
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
                this.warnings = [];
                this.errors = [];
            }
            this.checked = true;
        };

        reader.onerror = () => {
            this.message = 'An error occurred while reading the text';
            this.gameFileCheckOutput = undefined;
            this.warnings = [];
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
                        alert('The selected ZIP file does not contain a readable game.txt file.')
                        this.gameFileCheckOutput = undefined;
                        this.warnings = [];
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
                    this.warnings = [];
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
                    this.warnings = [];
                    this.errors = [];
                }
            }

            this.checked = true;
        } catch (error) {
            this.message = 'An error occurred while reading the ZIP file: ' + (error as Error).message;
            this.gameFileCheckOutput = undefined;
            this.warnings = [];
            this.errors = [];
        }
    }

    async checkGameFile(text: string): Promise<void> {
        if (this.originalGameFiles == undefined) {
            alert('Could not access original game files')
            return;
        }

        const extendedLog = text.toLowerCase().includes('file;hash');
        if (!extendedLog) {
            this.addWarning('NOT_EXTENDED_REPORT')
        }

        let output = '';
        let gameFileErrors = 0;
        const fileLines = this.splitIntoLines(text);
        for (let fileLine of fileLines) {
            if (fileLine.length == 0) continue;
            let file = fileLine
            if (extendedLog) {
                file = fileLine.split(';')[0]
            }
            if (file.toLowerCase().includes('battleeye') || file.toLowerCase().includes('.egstore') || file.toLowerCase().includes('redistributables') || file.toLowerCase().includes('readme') || file.toLowerCase().includes('eossdk-win64-shipping')) continue;
            if (file.toLowerCase().includes('reshade')) {
                this.addWarning('RESHADE_DETECTED')
                gameFileErrors++;
                continue;
            }
            if (file.toLowerCase().includes('enb')) {
                this.addWarning('ENB_DETECTED')
                gameFileErrors++;
                continue;
            }
            let hash = undefined;
            if (extendedLog) {
                hash = fileLine.split(';')[1]
            }
            const o = this.originalGameFiles.find(x => x.startsWith(file));
            if (o == undefined || hash != undefined && !o.includes(hash)) {
                console.log(`${file} has an invalid hash! (Should: ${(o != null ? o.split(';')[1] : undefined)} | Is: ${hash})`)

                const tag = o == undefined ? 'FILE_UNKNOWN' : 'FILE_HASH_DOES_NOT_MATCH';
                if (tag == 'FILE_UNKNOWN') {
                    this.addWarning(tag)
                } else {
                    this.addError(tag)
                }
                output += `${tag == 'FILE_UNKNOWN' ? '⚠️' : '❌'} ${file} (${tag})\n`
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

    async checkProcessesFile(text: string): Promise<void> {
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
            if (error.error != undefined) {
                this.addError(error.error)
                this.processesDetails.push(`❌ ${fileLine}`)
            } else if (error.warning != undefined) {
                this.addWarning(error.warning)
                this.processesDetails.push(`⚠️ ${fileLine}`)
            }
        }
    }

    async checkClientFile(text: string): Promise<void> {
        this.clientChecked = true;
        this.clientFailed = 0;
        this.clientDetails = [];
        const fileLines = this.splitIntoLines(text);
        for (let fileLine of fileLines) {
            const error = this.originalClient.find(s => fileLine.toLowerCase().includes(s.name.toLowerCase()));
            if (error == undefined) continue;
            this.clientFailed++;
            if (error.error != undefined) {
                this.addError(error.error)
                this.clientDetails.push(`❌ ${fileLine}`)
            } else if (error.warning != undefined) {
                this.addWarning(error.warning)
                this.clientDetails.push(`⚠️ ${fileLine}`)
            }
        }
    }

    async loadRequiredFiles(http: HttpClient): Promise<void> {
        try {
            // game.txt
            {
                const originalGameFiles = await http.get('https://raw.githubusercontent.com/shloooo/altv-file-check/data-files/checks/game.txt', {responseType: 'text'}).toPromise();
                if (originalGameFiles == undefined) {
                    this.message = 'game.txt has no readable text';
                    this.gameFileCheckOutput = undefined;
                    this.warnings = [];
                    this.errors = [];
                    this.uploadDisabled = true;
                    return;
                }

                if (this.isTextReadable(originalGameFiles)) {
                    this.originalGameFiles = this.splitIntoLines(originalGameFiles);
                } else {
                    this.message = 'game.txt has no readable text';
                    this.gameFileCheckOutput = undefined;
                    this.warnings = [];
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
                    this.warnings = [];
                    this.errors = [];
                    this.uploadDisabled = true;
                    return;
                }

                try {
                    this.originalProcesses = JSON.parse(originalProcesses)
                } catch (e) {
                    this.message = 'Could not load process.json';
                    this.gameFileCheckOutput = undefined;
                    this.warnings = [];
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
                    this.warnings = [];
                    this.errors = [];
                    this.uploadDisabled = true;
                    return;
                }

                try {
                    this.originalClient = JSON.parse(originalClient)
                } catch (e) {
                    this.message = 'Could not load client.json';
                    this.gameFileCheckOutput = undefined;
                    this.warnings = [];
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

    addWarning(identifier: string) {
        if (!this.warnings.includes(identifier)) {
            this.warnings.push(identifier);
        }
    }

    addError(identifier: string) {
        if (!this.errors.includes(identifier)) {
            this.errors.push(identifier);
        }
    }

    result(): CheckResult {
        return {
            message: this.message,

            // game.txt check
            gameFileErrors: this.gameFileErrors,
            gameFilesTotal: this.gameFilesTotal,
            gameFileCheckOutput: this.gameFileCheckOutput,
            uploadDisabled: this.uploadDisabled,
            checked: this.checked,

            // processes.txt check
            processesChecked: this.processesChecked,
            processesChecked2: this.processesChecked2,
            processesFailed: this.processesFailed,
            processesDetails: this.processesDetails,

            // client.log check
            clientChecked: this.clientChecked,
            clientFailed: this.clientFailed,
            clientDetails: this.clientDetails,

            // ERRORS
            warnings: this.warnings,
            errors: this.errors
            // ERRORS
        }
    }
}

export class CheckResult {
    message: string = 'check.not-started';

    // game.txt check
    gameFileErrors: number = 0;
    gameFilesTotal: number = 0;
    gameFileCheckOutput: string[] | undefined = undefined;
    uploadDisabled: boolean = false;
    checked: boolean = false;

    // processes.txt check
    processesChecked: boolean = false;
    processesChecked2: number = 0;
    processesFailed: number = 0;
    processesDetails: string[] = [];

    // client.log check
    clientChecked: boolean = false;
    clientFailed: number = 0;
    clientDetails: string[] = [];

    // ERRORS
    warnings: string[] = [];
    errors: string[] = [];
    // ERRORS
}