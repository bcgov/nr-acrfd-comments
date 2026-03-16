import { Component } from '@angular/core'
import { CommonModule } from '@angular/common'
import { LoadingService } from 'app/services/loading.service'

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="isLoading$ | async" class="spinner"></div>
  `,
  styles: [
    `
      .spinner {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 40px;
        height: 40px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        z-index: 9999;
      }
      @keyframes spin {
        0% {
          transform: translate(-50%, -50%) rotate(0deg);
        }
        100% {
          transform: translate(-50%, -50%) rotate(360deg);
        }
      }
    `,
  ],
})
export class LoadingSpinnerComponent {
  isLoading$ = this.loadingService.loading$

  constructor(private loadingService: LoadingService) {}
}
