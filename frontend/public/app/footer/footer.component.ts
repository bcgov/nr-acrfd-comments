import { Component } from '@angular/core'
import { ApiService } from 'app/services/api'
import { Router } from '@angular/router'
import { environment } from 'environments/environment'

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
})
export class FooterComponent {
  public version: string = environment.version

  constructor(
    public api: ApiService,
    public router: Router,
  ) {}
}
