import { Injectable } from '@angular/core'
import { JwtUtil } from 'app/jwt-util'
import { Observable } from 'rxjs'
import * as _ from 'lodash'
import Keycloak from 'keycloak-js'

@Injectable()
export class KeycloakService {
  private keycloakAuth: any
  private keycloakEnabled: boolean
  private keycloakUrl: string
  private keycloakRealm: string
  private loggedOut: string

  constructor() {
    const origin = window.location.origin

    console.log('~~~')
    if (origin === 'http://localhost:4200') {
      // Local development - Keycloak disabled
      this.keycloakEnabled = false
      console.log('Local')
    } else if (
      origin === 'https://nrts-prc-dev.pathfinder.gov.bc.ca' ||
      origin === 'https://nrts-prc-master.pathfinder.gov.bc.ca' ||
      origin === 'https://acrfd-86cabb-dev.apps.silver.devops.gov.bc.ca' ||
      origin === 'https://acrfd-admin-86cabb-dev.apps.silver.devops.gov.bc.ca' ||
      // PR deployments: nr-acrfd-comments-<pr-number>.apps.silver.devops.gov.bc.ca
      /^https:\/\/nr-acrfd-comments-\d+\.apps\.silver\.devops\.gov\.bc\.ca$/.test(origin)
    ) {
      // Dev, Master, PR deployments
      this.keycloakEnabled = true
      this.keycloakUrl = 'https://dev.loginproxy.gov.bc.ca/auth'
      this.keycloakRealm = 'standard'
      console.log('Dev')
    } else if (
      origin === 'https://nrts-prc-test.pathfinder.gov.bc.ca' ||
      origin === 'https://acrfd-86cabb-test.apps.silver.devops.gov.bc.ca' ||
      origin === 'https://nr-acrfd-comments-test.apps.silver.devops.gov.bc.ca'
    ) {
      // Test
      this.keycloakEnabled = true
      this.keycloakUrl = 'https://test.loginproxy.gov.bc.ca/auth'
      this.keycloakRealm = 'standard'
      console.log('Test')
    } else {
      // Prod
      this.keycloakEnabled = true
      this.keycloakUrl = 'https://loginproxy.gov.bc.ca/auth'
      this.keycloakRealm = 'standard'
      console.log('Prod')
    }
  }

  isKeyCloakEnabled(): boolean {
    return this.keycloakEnabled
  }

  private getParameterByName(name) {
    const url = window.location.href
    name = name.replace(/[\[\]]/g, '\\$&')
    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
    const results = regex.exec(url)
    if (!results) {
      return null
    }
    if (!results[2]) {
      return ''
    }
    return decodeURIComponent(results[2].replace(/\+/g, ' '))
  }

  init(): Promise<any> {
    this.loggedOut = this.getParameterByName('loggedout')

    if (this.keycloakEnabled) {
      // Bootup KC
      this.keycloakEnabled = true
      return new Promise<void>((resolve, reject) => {
        const config = {
          url: this.keycloakUrl,
          realm: this.keycloakRealm,
          clientId: 'acrfd-4192',
        }

        // console.log('KC Auth init.');

        this.keycloakAuth = new Keycloak(config)
        this.keycloakAuth.onAuthSuccess = () => {
          // console.log('onAuthSuccess');
        }

        this.keycloakAuth.onAuthError = () => {
          console.log('onAuthError')
        }

        this.keycloakAuth.onAuthRefreshSuccess = () => {
          // console.log('onAuthRefreshSuccess');
        }

        this.keycloakAuth.onAuthRefreshError = () => {
          console.log('onAuthRefreshError')
        }

        this.keycloakAuth.onAuthLogout = () => {
          // console.log('onAuthLogout');
        }

        // Try to get refresh tokens in the background
        this.keycloakAuth.onTokenExpired = () => {
          this.keycloakAuth
            .updateToken()
            .then((refreshed) => {
              console.log('KC refreshed token?:', refreshed)
            })
            .catch((err) => {
              console.log('KC refresh error:', err)
            })
        }

        // Initialize.

        const initOptions = {
          checkLoginIframe: false,
          pkceMethod: 'S256',
          onLoad: 'login-required',
        }

        this.keycloakAuth
          .init(initOptions)
          .then((auth) => {
            // console.log('KC Refresh Success?:', this.keycloakAuth.authServerUrl);
            console.log('KC Success:', auth)
            if (!auth) {
              if (this.loggedOut === 'true') {
                // Don't do anything, they wanted to remain logged out.
                resolve()
              } else {
                this.keycloakAuth.login({ idpHint: 'idir' })
              }
            } else {
              resolve()
            }
          })
          .catch((err) => {
            console.log('KC error:', err)
            reject()
          })
      })
    }
  }

  isValidForSite() {
    if (!this.getToken()) {
      return false
    }
    const jwt = new JwtUtil().decodeToken(this.getToken())
    if (jwt && jwt.client_roles) {
      return _.includes(jwt.client_roles, 'sysadmin')
    } else {
      return false
    }
  }

  /**
   * Returns the current keycloak auth token.
   *
   * @returns {string} keycloak auth token.
   * @memberof KeycloakService
   */
  getToken(): string {
    if (!this.keycloakEnabled) {
      // return the local storage token
      const currentUser = JSON.parse(window.localStorage.getItem('currentUser'))
      return currentUser ? currentUser.token : null
    }

    return this.keycloakAuth.token
  }

  /**
   * Returns an observable that emits when the auth token has been refreshed.
   * Call {@link KeycloakService#getToken} to fetch the updated token.
   *
   * @returns {Observable<string>}
   * @memberof KeycloakService
   */
  refreshToken(): Observable<any> {
    return new Observable((observer) => {
      this.keycloakAuth
        .updateToken(30)
        .then((refreshed) => {
          console.log('KC refreshed token?:', refreshed)
          observer.next()
          observer.complete()
        })
        .catch((err) => {
          console.log('KC refresh error:', err)
          observer.error()
        })

      return { unsubscribe() {} }
    })
  }

  getLogoutURL(): string {
    // TODO? need to do two stage logoff.
    // logoff prc, as well as bcgov?
    // https://logon.gov.bc.ca/clp-cgi/logoff.cgi?returl=http://localhost:4200/admin/
    // https://logontest.gov.bc.ca/clp-cgi/logoff.cgi?returl=http://localhost:4200/admin/
    if (this.keycloakEnabled) {
      return (
        this.keycloakAuth.authServerUrl +
        '/realms/' +
        this.keycloakRealm +
        '/protocol/openid-connect/logout?redirect_uri=' +
        window.location.origin +
        '/admin/not-authorized?loggedout=true'
      )
    } else {
      // go to the /login page
      return window.location.origin + '/admin/login'
    }
  }
}
