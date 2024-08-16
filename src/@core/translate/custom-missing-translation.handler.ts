import {MissingTranslationHandler, MissingTranslationHandlerParams} from "@ngx-translate/core";

export class CustomMissingTranslationHandler extends MissingTranslationHandler {

    handle(params: MissingTranslationHandlerParams): any {
        if (!params.key.includes(' ')) console.warn('[Handler] Could not find translation for \'' + params.key + '\'');
        return params.key;
    }
}
