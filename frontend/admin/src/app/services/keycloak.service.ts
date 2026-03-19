import { Injectable } from '@angular/core'
import { JwtUtil } from 'app/jwt-util'
import { Observable } from 'rxjs'
import * as _ from 'lodash'

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
      origin === 'https://nr-acrfd-comments-test.apps.silver.devops.gov.bc.ca' ||
      // Test PR deployments
      /^https:\/\/nr-acrfd-comments-\d+-test\.apps\.silver\.devops\.gov\.bc\.ca$/.test(origin)
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
        // Check if Keycloak library is loaded
        if (typeof (window as any).Keycloak === 'undefined') {
          console.error('Keycloak library not loaded. Attempting dynamic load...')
          this.loadKeycloakLibrary()
            .then(() => this.initializeKeycloak(resolve, reject))
            .catch((err) => {
              console.error('Failed to load Keycloak library:', err)
              reject(err)
            })
        } else {
          this.initializeKeycloak(resolve, reject)
        }
      })
    } else {
      return Promise.resolve()
    }
  }

  private loadKeycloakLibrary(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'node_modules/keycloak-js/dist/keycloak.js'
      script.onload = () => {
        console.log('Keycloak library loaded successfully')
        resolve()
      }
      script.onerror = () => {
        console.error('Failed to load keycloak.js script')
        reject(new Error('Failed to load keycloak.js'))
      }
      document.head.appendChild(script)
    })
  }

  private initializeKeycloak(resolve, reject) {
    const config = {
      url: this.keycloakUrl,
      realm: this.keycloakRealm,
      clientId: 'acrfd-4192',
    }

    console.log('Initializing Keycloak with config:', config)

    try {
      this.keycloakAuth = new (window as any).Keycloak(config)
    } catch (e) {
      console.error('Failed to instantiate Keycloak:', e)
      reject(e)
      return
    }

    this.keycloakAuth.onAuthSuccess = () => {
      console.log('Keycloak auth success')
    }

    this.keycloakAuth.onAuthError = () => {
      console.log('Keycloak auth error')
    }

    this.keycloakAuth.onAuthRefreshSuccess = () => {
      console.log('Keycloak token refresh success')
    }

    this.keycloakAuth.onAuthRefreshError = () => {
      console.log('Keycloak token refresh error')
    }

    this.keycloakAuth.onAuthLogout = () => {
      console.log('Keycloak logout')
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

    const initOptions = {
      checkLoginIframe: false,
      pkceMethod: 'S256',
      onLoad: 'login-required',
    }

    console.log('Calling Keycloak.init() with options:', initOptions)

    this.keycloakAuth
      .init(initOptions)
      .then((auth) => {
        console.log('KC init success, authenticated:', auth)
        if (!auth) {
          if (this.loggedOut === 'true') {
            // Don't do anything, they wanted to remain logged out.
            console.log('User logged out, not redirecting')
            resolve()
          } else {
            console.log('Not authenticated, redirecting to login with IDIR hint')
            this.keycloakAuth.login({ idpHint: 'idir' })
          }
        } else {
          console.log('User already authenticated')
          resolve()
        }
      })
      .catch((err) => {
        console.error('KC init error:', err)
        reject(err)
      })
  }

  isValidForSite() {
    const token = this.getToken()
    if (!token) {
      console.log('isValidForSite: No token found')
      return false
    }
    const jwt = new JwtUtil().decodeToken(token)
    console.log('isValidForSite: JWT decoded:', jwt)
    console.log('isValidForSite: client_roles:', jwt && jwt.client_roles)
    console.log(
      'isValidForSite: realm_access.roles:',
      jwt && jwt.realm_access && jwt.realm_access.roles,
    )

    // Check both client_roles and realm_access.roles for sysadmin
    const hasClientRole = jwt && jwt.client_roles && _.includes(jwt.client_roles, 'sysadmin')
    const hasRealmRole = jwt && jwt.realm_access && _.includes(jwt.realm_access.roles, 'sysadmin')

    console.log('isValidForSite: hasClientRole:', hasClientRole, 'hasRealmRole:', hasRealmRole)
    const isValid = hasClientRole || hasRealmRole
    console.log('isValidForSite: Final result:', isValid)

    return isValid
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

    // Safety check: ensure keycloakAuth is initialized
    if (!this.keycloakAuth) {
      console.warn('Keycloak service not initialized yet')
      return null
    }

    // Support both keycloak-js v16 (.token property) and v18+ (.getToken() method)
    if (typeof this.keycloakAuth.getToken === 'function') {
      // keycloak-js v18+
      console.log('Using keycloak-js v18+ API (.getToken() method)')
      return this.keycloakAuth.getToken()
    } else if (this.keycloakAuth.token) {
      // keycloak-js v16 and earlier
      console.log('Using keycloak-js v16 API (.token property)')
      return this.keycloakAuth.token
    } else {
      console.warn(
        'Unable to get token from Keycloak. Neither .getToken() nor .token are available.',
      )
      return null
    }
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
      if (!this.keycloakAuth || typeof this.keycloakAuth.updateToken !== 'function') {
        console.warn('Keycloak not initialized for token refresh')
        observer.error('Keycloak not initialized')
        return
      }

      this.keycloakAuth
        .updateToken(30)
        .then((refreshed) => {
          console.log('KC refreshed token?:', refreshed)
          observer.next()
          observer.complete()
        })
        .catch((err) => {
          console.log('KC refresh error:', err)
          observer.error(err)
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
