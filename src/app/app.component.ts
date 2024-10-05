import {Component, Inject, LOCALE_ID, OnInit} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {NgForOf, NgIf} from "@angular/common";
import {HttpClient} from "@angular/common/http";
import {CollapsibleSpanComponent} from "./collapsible-span/collapsible-span.component";
import {TranslateModule, TranslateService} from "@ngx-translate/core";
import {SafePipe} from "../@core/pipes/safe.pipe";
import {CheckResult, FileCheckApi} from "./api/file-check.api";

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, NgIf, CollapsibleSpanComponent, TranslateModule, NgForOf, SafePipe],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {

    api: FileCheckApi = new FileCheckApi();
    result: CheckResult = new CheckResult()

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
        await this.api.init(this.http)
        this.result = this.api.result();
    }

    async onFileSelected(event: Event): Promise<void> {
        if (this.result.uploadDisabled) {
            alert('Upload is disabled')
            return;
        }

        const input = event.target as HTMLInputElement;

        this.result.message = 'check.in-progress';
        this.result.errors = [];
        this.result.processesChecked = false;
        this.result.clientChecked = false;
        if (input.files && input.files.length > 0) {
            const file = input.files[0];

            this.result = await this.api.processFile(file)
        }
    }

    getTranslatedArray(key: string): string[] {
        let translatedArray: string[] = [];

        this.translate.get(key).subscribe((res: any) => {
            if (res && Array.isArray(res)) {
                translatedArray = res;
            }
        });

        return translatedArray;
    }
}
