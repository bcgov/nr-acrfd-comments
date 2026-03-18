import { HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { KeycloakService } from 'app/services/keycloak.service'
import { Observable, Subject, throwError } from 'rxjs'
import { catchError, switchMap, tap } from 'rxjs/operators'

/**
 * Intercepts all http requests and allows for the request and/or response to be manipulated.
 *
 * @export
 * @class TokenInterceptor
 * @implements {HttpInterceptor}
 */
@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  private refreshTokenInProgress = false

  private tokenRefreshedSource = new Subject()
  private tokenRefreshed$ = this.tokenRefreshedSource.asObservable()

  constructor(private auth: KeycloakService) {}

  /**
   * Main request intercept handler to automatically add the bearer auth token to every request.
   * If the auth token expires mid-request, the requests 403 response will be caught, the auth token will be
   * refreshed, and the request will be re-tried.
   *
   * @param {HttpRequest<any>} request
   * @param {HttpHandler} next
   * @returns {Observable<HttpEvent<any>>}
   * @memberof TokenInterceptor
   */
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<any> {
    request = this.addAuthHeader(request)

    return next.handle(request).pipe(
      catchError((error) => {
        console.log('TokenInterceptor: Caught error with status:', error.status)
        if (error.status === 403) {
          console.log('TokenInterceptor: Got 403, attempting token refresh')
          return this.refreshToken().pipe(
            switchMap(() => {
              console.log('TokenInterceptor: Token refreshed, retrying request')
              request = this.addAuthHeader(request)
              return next.handle(request)
            }),
            catchError((err) => {
              console.error('TokenInterceptor: Token refresh failed, not retrying request', err)
              return throwError(err)
            }),
          )
        }
        return throwError(error)
      }),
    )
  }

  /**
   * Fetches and adds the bearer auth token to the request.
   *
   * @private
   * @param {HttpRequest<any>} request to modify
   * @returns {HttpRequest<any>}
   * @memberof TokenInterceptor
   */
  private addAuthHeader(request: HttpRequest<any>): HttpRequest<any> {
    const authToken: string = this.auth.getToken()

    console.log('TokenInterceptor: Getting token for request to', request.url)
    console.log(
      'TokenInterceptor: Token obtained:',
      authToken ? '***' + authToken.substring(authToken.length - 10) : 'null',
    )

    if (authToken) {
      request = request.clone({
        setHeaders: { Authorization: 'Bearer ' + authToken },
      })
      console.log('TokenInterceptor: Added Authorization header')
    } else {
      console.warn(
        'TokenInterceptor: No token available, request will be sent without Authorization header',
      )
    }

    return request
  }

  /**
   * Attempts to refresh the auth token.
   *
   * @private
   * @returns {Observable<any>}
   * @memberof TokenInterceptor
   */
  private refreshToken(): Observable<any> {
    if (this.refreshTokenInProgress) {
      console.log('TokenInterceptor: Refresh already in progress, waiting...')
      return new Observable((observer) => {
        this.tokenRefreshed$.subscribe(() => {
          console.log('TokenInterceptor: Refresh completed, resuming')
          observer.next()
          observer.complete()
        })
      })
    } else {
      console.log('TokenInterceptor: Starting token refresh')
      this.refreshTokenInProgress = true

      return this.auth.refreshToken().pipe(
        tap(() => {
          console.log('TokenInterceptor: Token refresh succeeded')
          this.refreshTokenInProgress = false
          this.tokenRefreshedSource.next()
        }),
      )
    }
  }
}
