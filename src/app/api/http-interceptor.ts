import {Injectable} from '@angular/core';
import {HttpClient, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse} from '@angular/common/http';
import {catchError, from, Observable, of, switchMap, throwError} from 'rxjs';
import {FileCheckApi} from "./file-check.api";

@Injectable()
export class FileInterceptor implements HttpInterceptor {

    constructor(private http: HttpClient) {

    }

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<any> {
        if (req.url.includes('api') && req.method === 'POST') {
            const file = req.body.get('file');

            if (file) {
                return from(this.check(file)).pipe(
                    switchMap(data => {
                        if (!data) {
                            return throwError({ error: 'Invalid file. Only ZIP files are allowed.' });
                        }
                        return of(new HttpResponse({ status: 200, body: { message: JSON.stringify(data) } }));
                    }),
                    catchError(error => {
                        return throwError(error);
                    })
                )
            }

            return throwError({error: `Invalid file`});
        }

        return next.handle(req).pipe(
            catchError(error => {
                // Hier kannst du Fehlerbehandlung hinzufügen
                return throwError(error);
            })
        );
    }

    check(file: any) {
        return new Promise(async resolve => {
            await FileCheckApi.init(this.http)

            if (file.type === 'text/plain') {
                resolve({error: `File is valid: ${file.name} | TYPE: TXT | ${FileCheckApi.originalGameFiles}`});
                return;
            } else if (file.name.endsWith('.zip')) {
                resolve({error: `File is valid: ${file.name} | TYPE: ZIP | ${FileCheckApi.originalGameFiles}`});
                return;
            }

            return throwError({error: `File: ${file.name} | ${FileCheckApi.originalGameFiles}`});
        })
    }
}