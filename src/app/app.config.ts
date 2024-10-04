import {ApplicationConfig, importProvidersFrom, provideZoneChangeDetection} from '@angular/core';
import {provideRouter} from '@angular/router';

import {routes} from './app.routes';
import {HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi} from "@angular/common/http";
import {provideAnimations} from "@angular/platform-browser/animations";
import {MissingTranslationHandler, TranslateLoader, TranslateModule} from "@ngx-translate/core";
import {TranslateHttpLoader} from "@ngx-translate/http-loader";
import {CustomMissingTranslationHandler} from "../@core/translate/custom-missing-translation.handler";
import {FileInterceptor} from "./api/http-interceptor";

export const appConfig: ApplicationConfig = {
    providers: [
        {provide: HTTP_INTERCEPTORS, useClass: FileInterceptor, multi: true},
        provideZoneChangeDetection({eventCoalescing: true}),
        provideRouter(routes),
        provideHttpClient(withInterceptorsFromDi()),
        provideAnimations(),
        importProvidersFrom(
            TranslateModule.forRoot({
                loader: {
                    provide: TranslateLoader,
                    useFactory: (createTranslateLoader),
                    deps: [HttpClient]
                },
                missingTranslationHandler: {
                    provide: MissingTranslationHandler,
                    useClass: CustomMissingTranslationHandler
                }
            })
        )
    ]
};

export function createTranslateLoader(http: HttpClient) {
    return new TranslateHttpLoader(http, 'https://raw.githubusercontent.com/shloooo/altv-file-check/data-files/i18n/', '.json');
}
