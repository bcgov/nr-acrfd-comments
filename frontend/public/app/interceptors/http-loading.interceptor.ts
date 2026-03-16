import { Injectable } from '@angular/core'
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http'
import { Observable } from 'rxjs'
import { finalize } from 'rxjs/operators'
import { LoadingService } from 'app/services/loading.service'

/**
 * HTTP Interceptor that shows a loading spinner during API requests
 */
@Injectable()
export class HttpLoadingInterceptor implements HttpInterceptor {
  constructor(private loadingService: LoadingService) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Skip spinner for health checks
    if (request.url.includes('/api/health') || request.url.includes('healthz')) {
      return next.handle(request)
    }

    this.loadingService.show()
    return next.handle(request).pipe(finalize(() => this.loadingService.hide()))
  }
}
