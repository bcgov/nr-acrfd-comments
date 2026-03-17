import { Injectable } from '@angular/core'
import { BehaviorSubject, Observable } from 'rxjs'
import { debounceTime } from 'rxjs/operators'

/**
 * Service to manage loading state across the application.
 * Shows spinner after 250ms delay to avoid flashing on fast requests.
 */
@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  private loadingSubject = new BehaviorSubject<boolean>(false)
  // Delay spinner appearance by 250ms to avoid flashing on fast requests
  public loading$: Observable<boolean> = this.loadingSubject.pipe(debounceTime(250))

  private requestCount = 0

  show(): void {
    this.requestCount++
    this.loadingSubject.next(true)
  }

  hide(): void {
    this.requestCount--
    if (this.requestCount <= 0) {
      this.requestCount = 0
      this.loadingSubject.next(false)
    }
  }

  reset(): void {
    this.requestCount = 0
    this.loadingSubject.next(false)
  }
}
