import { Component, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import * as moment from 'moment';
import * as _ from 'lodash';
import * as JSZip from 'jszip';
import { saveAs } from 'file-saver';

import { Application } from 'app/models/application';
import { Comment } from 'app/models/comment';
import { ApiService } from 'app/services/api';
import { CommentService } from 'app/services/comment.service';
import { DocumentService } from 'app/services/document.service';
import { ExportService } from 'app/services/export.service';

class SortKey {
  innerHTML: string;
  value: string;
}

@Component({
  selector: 'app-review-comments',
  templateUrl: './review-comments.component.html',
  styleUrls: ['./review-comments.component.scss']
})
export class ReviewCommentsComponent implements OnInit, OnDestroy {
  readonly PAGE_SIZE = 20;

  @ViewChild('commentListScrollContainer', { read: ElementRef })
  public commentListScrollContainer: ElementRef;

  readonly sortKeys: SortKey[] = [
    { innerHTML: 'Oldest', value: '%2BdateAdded' },
    { innerHTML: 'Newest', value: '-dateAdded' },
    { innerHTML: 'Name (A-Z)', value: '%2BcontactName' },
    { innerHTML: 'Name (Z-A)', value: '-contactName' }
  ];

  public loading = false;
  public application: Application = null;
  public comments: Comment[] = [];
  public alerts: string[] = [];
  public currentComment: Comment;
  public pageCount = 1; // in case getCount() fails
  public pageNum = 1; // first page
  public sortBy = this.sortKeys[1].value; // initial sort is by descending date

  // see official solution:
  // https://stackoverflow.com/questions/38008334/angular-rxjs-when-should-i-unsubscribe-from-subscription
  // or http://brianflove.com/2016/12/11/anguar-2-unsubscribe-observables/
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private commentService: CommentService,
    private documentService: DocumentService,
    private exportService: ExportService
  ) {}

  ngOnInit() {
    // get data from route resolver
    this.route.data.pipe(takeUntil(this.ngUnsubscribe)).subscribe((data: { application: Application }) => {
      if (data.application) {
        this.application = data.application;

        this.commentService
          .getCountByPeriodId(this.application.meta.currentPeriod._id)
          .pipe(takeUntil(this.ngUnsubscribe))
          .subscribe(value => {
            this.pageCount = value ? Math.ceil(value / this.PAGE_SIZE) : 1;
            // get initial data
            this.getData();
          });
      } else {
        alert("Uh-oh, couldn't load application");
        // application not found --> navigate back to search
        this.router.navigate(['/search']);
      }
    });
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  getData() {
    if (this.application) {
      // safety check
      this.loading = true;
      this.commentListScrollContainer.nativeElement.scrollTop = 0;

      // get a page of comments
      this.commentService
        .getAllByApplicationId(this.application._id, this.pageNum - 1, this.PAGE_SIZE, this.sortBy, {
          getDocuments: true
        })
        .pipe(takeUntil(this.ngUnsubscribe))
        .subscribe(
          comments => {
            this.loading = false;
            this.comments = comments;

            // pre-select the first comment
            if (this.comments.length > 0) {
              this.setCurrentComment(this.comments[0]);
            }
          },
          error => {
            this.loading = false;
            // if 403, redir to login page
            if (error && error.status === 403) {
              this.router.navigate(['/login']);
            }
            this.alerts.push('Error loading comments');
          }
        );
    }
  }

  prevPage() {
    this.pageNum--;
    this.getData();
  }

  nextPage() {
    this.pageNum++;
    this.getData();
  }

  setCurrentComment(item: Comment) {
    const index = _.findIndex(this.comments, { _id: item._id });
    if (index >= 0) {
      this.comments.splice(index, 1, item);
      this.currentComment = item;
    }
  }

  isCurrentComment(item: Comment): boolean {
    return item === this.currentComment;
  }

  exportToExcel() {
    // get all comments
    this.commentService
      .getAllByApplicationId(this.application._id, 0, 1000000, null, { getDocuments: true }) // max 1M records
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(
        comments => {
          // FUTURE: instead of flattening, copy to new 'export object' with user-friendly keys?
          const flatComments = comments.map(comment => {
            // sanitize and flatten each comment object
            delete comment._commentPeriod;
            delete comment.commentNumber;
            // sanitize commentAuthor
            if (comment.commentAuthor) {
              delete comment.commentAuthor['isPublished'];
              delete comment.commentAuthor['_userId'];
              if (comment.commentAuthor['internal']) {
                delete comment.commentAuthor['internal']['isPublished'];
              }
            }
            // sanitize review
            if (comment.review) {
              delete comment.review['isPublished'];
              delete comment.review['_reviewerId'];
            }
            // sanitize documents
            comment.documents.forEach(document => {
              delete document._id;
              delete document._addedBy;
              delete document._application;
              delete document._decision;
              delete document._comment;
              delete document.internalURL;
              delete document.internalMime;
              delete document.isDeleted;
              delete document.meta;
            });
            // add necessary properties
            // comment.applicants = this.application.meta.applicants; // FUTURE
            comment['cl_file'] = this.application.meta.clFile;
            return this.flatten_fastest(comment);
          });

          const excelFileName =
            'comments-' + this.application.meta.applicants.replace(/\s/g, '_') + moment(new Date()).format('-YYYYMMDD');
          const columnOrder: string[] = [
            'cl_file',
            '_id',
            '_addedBy',
            'dateAdded',
            'commentStatus',
            'isPublished',
            'review.reviewerDate',
            'review.reviewerNotes',
            'commentAuthor.contactName',
            'commentAuthor.orgName',
            'commentAuthor.location',
            'commentAuthor.requestedAnonymous',
            'commentAuthor.internal.email',
            'commentAuthor.internal.phone',
            'comment'
          ];
          this.exportService.exportAsExcelFile(flatComments, excelFileName, columnOrder);
        },
        error => console.log('error =', error)
      );
  }

  /** HTML + ZIP start */
  async exportToHtmlZip() {
    let allComments: Comment[];
    try {
      allComments = await this.commentService
        .getAllByApplicationId(this.application._id, 0, 1000000, '%2BdateAdded', { getDocuments: true }) // max 1M records, oldest first
        .pipe(takeUntil(this.ngUnsubscribe))
        .toPromise();
    } catch (error) {
      console.log('error =', error);
      return;
    }

    const zip = new JSZip();
    const docFolder = zip.folder('documents');

    // Fetch application-level documents
    let appDocuments = [];
    try {
      appDocuments = await this.documentService
        .getAllByApplicationId(this.application._id)
        .pipe(takeUntil(this.ngUnsubscribe))
        .toPromise();
    } catch (e) {
      console.warn('Could not fetch application documents', e);
    }

    // Collect all documents to download (application-level + comment-level)
    const commentDocs = allComments.reduce((acc, comment) => acc.concat(comment.documents), []);
    const allDocs = [...appDocuments, ...commentDocs].filter(doc => !!doc._id);

    // Download all blobs in parallel
    await Promise.all(
      allDocs.map(async doc => {
        try {
          const blob = await this.api.getDocumentBlob(doc._id);
          docFolder.file(doc.documentFileName, blob);
        } catch (e) {
          console.warn(`Could not download document: ${doc.documentFileName}`, e);
        }
      })
    );

    const htmlContent = this.generateHtmlReport(allComments);
    const baseName =
      'comments-' + this.application.meta.applicants.replace(/\s/g, '_') + moment(new Date()).format('-YYYYMMDD');
    zip.file(`${baseName}.html`, htmlContent);

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, `${baseName}.zip`);
  }

  private generateHtmlReport(comments: Comment[]): string {
    const app = this.application;
    const periodStart = app.meta.currentPeriod && app.meta.currentPeriod.startDate
      ? new Date(app.meta.currentPeriod.startDate).toLocaleDateString('en-CA')
      : '—';
    const periodEnd = app.meta.currentPeriod && app.meta.currentPeriod.endDate
      ? new Date(app.meta.currentPeriod.endDate).toLocaleDateString('en-CA')
      : '—';

    const escHtml = (val: any): string => {
      if (val == null) { return '—'; }
      return String(val)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };

    const rows = comments.map(c => {
      const author = c.commentAuthor;
      const inlineExts = /\.(pdf|jpg|jpeg|png|gif|webp|svg|bmp|tiff?|mp4|webm|mp3|wav|ogg)$/i;
      const docNames = c.documents && c.documents.length
        ? c.documents.map(d => {
            const label = escHtml(d.displayName || d.documentFileName);
            if (inlineExts.test(d.documentFileName)) {
              const href = 'documents/' + encodeURIComponent(d.documentFileName);
              return `<a href="${href}" target="_blank">${label}</a>`;
            }
            return label;
          }).join('<br>')
        : '—';
      const dateRaw = c.dateAdded ? new Date(c.dateAdded).toISOString() : '';
      const dateDisplay = c.dateAdded ? new Date(c.dateAdded).toLocaleDateString('en-CA') : '—';
      return `
        <tr>
          <td class="date-col" data-sort="${escHtml(dateRaw)}">${dateDisplay}</td>
          <td>${escHtml(author && author.contactName)}</td>
          <td>${escHtml(author && author.orgName)}</td>
          <td>${escHtml(author && author.location)}</td>
          <td>${escHtml(author && author.requestedAnonymous ? 'Yes' : 'No')}</td>
          <td>${escHtml(author && author.internal && author.internal.email)}</td>
          <td>${escHtml(author && author.internal && author.internal.phone)}</td>
          <td class="comment-text">${escHtml(c.comment)}</td>
          <td>${escHtml(c.commentStatus)}</td>
          <td>${escHtml(c.review && c.review.reviewerNotes)}</td>
          <td>${docNames}</td>
        </tr>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comments – Crown Land File: ${escHtml(app.meta.clFile)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #222; margin: 0; padding: 24px; background: #f5f5f5; }
    h1 { font-size: 22px; margin-bottom: 4px; color: #003366; }
    .app-info { background: #fff; border: 1px solid #d0d0d0; border-radius: 4px; padding: 16px 20px; margin-bottom: 24px; max-width: 860px; }
    .app-info table { border-collapse: collapse; width: 100%; }
    .app-info td { padding: 4px 8px; vertical-align: top; }
    .app-info td:first-child { font-weight: bold; white-space: nowrap; width: 180px; color: #555; }
    h2 { font-size: 17px; margin-bottom: 10px; color: #003366; }
    .table-wrapper { overflow-x: auto; }
    table.comments { border-collapse: collapse; width: 100%; background: #fff; border: 1px solid #d0d0d0; border-radius: 4px; }
    table.comments thead th { background: #003366; color: #fff; padding: 10px 12px; text-align: left; white-space: nowrap; user-select: none; }
    table.comments thead th.sortable { cursor: pointer; }
    table.comments thead th.sortable:hover { background: #00509e; }
    table.comments thead th .sort-arrow { display: inline-block; margin-left: 6px; opacity: 0.6; }
    table.comments thead th.asc .sort-arrow::after { content: '▲'; }
    table.comments thead th.desc .sort-arrow::after { content: '▼'; }
    table.comments thead th:not(.asc):not(.desc) .sort-arrow::after { content: '⇅'; }
    table.comments tbody tr:nth-child(even) { background: #f0f4f8; }
    table.comments td { padding: 8px 12px; vertical-align: top; border-top: 1px solid #e0e0e0; }
    td.comment-text { min-width: 400px; width: 30%; white-space: pre-wrap; word-break: break-word; }
    td.date-col { min-width: 100px; white-space: nowrap; }
    .filter-bar { margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
    .filter-bar label { font-weight: bold; color: #003366; white-space: nowrap; }
    .filter-bar input { padding: 6px 10px; font-size: 14px; border: 1px solid #bbb; border-radius: 4px; width: 320px; }
    .filter-bar .filter-count { font-size: 13px; color: #555; }
    .generated { font-size: 12px; color: #888; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="app-info">
    <h1>Comments – Crown Land File: ${escHtml(app.meta.clFile)}</h1>
    <table>
      <tr><td>Applicant(s):</td><td>${escHtml(app.meta.applicants)}</td></tr>
      <tr><td>Purpose / Subpurpose:</td><td>${escHtml(app.purpose)} / ${escHtml(app.subpurpose)}</td></tr>
      <tr><td>Type / Subtype:</td><td>${escHtml(app.type)} / ${escHtml(app.subtype)}</td></tr>
      <tr><td>Location:</td><td>${escHtml(app.location)}</td></tr>
      <tr><td>Description:</td><td>${escHtml(app.description)}</td></tr>
      <tr><td>Comment Period:</td><td>${escHtml(periodStart)} – ${escHtml(periodEnd)}</td></tr>
      <tr><td>Total Comments:</td><td>${escHtml(comments.length)}</td></tr>
    </table>
  </div>

  <h2>Comments (${escHtml(comments.length)})</h2>
  <div class="filter-bar">
    <label for="filterInput">Filter:</label>
    <input type="text" id="filterInput" placeholder="" autocomplete="off">
  </div>
  <div class="table-wrapper">
    <table class="comments" id="commentsTable">
      <thead>
        <tr>
          <th class="sortable date-col" data-col="0">Date<span class="sort-arrow"></span></th>
          <th>Contact Name</th>
          <th>Organization</th>
          <th>Location</th>
          <th>Anon?</th>
          <th>Email</th>
          <th>Phone</th>
          <th>Comment</th>
          <th>Status</th>
          <th>Reviewer Notes</th>
          <th>Attachments</th>
        </tr>
      </thead>
      <tbody id="commentsBody">
        ${rows}
      </tbody>
    </table>
  </div>

  <p class="generated">Generated on ${new Date().toLocaleString('en-CA')}</p>

  <script>
    (function () {
      var table = document.getElementById('commentsTable');
      var tbody = document.getElementById('commentsBody');
      var headers = table.querySelectorAll('thead th.sortable');
      var sortState = { col: 0, dir: 'asc' };

      function sortTable(colIndex, dir) {
        var rows = Array.from(tbody.querySelectorAll('tr'));
        rows.sort(function (a, b) {
          var aVal = a.cells[colIndex].getAttribute('data-sort') || a.cells[colIndex].textContent || '';
          var bVal = b.cells[colIndex].getAttribute('data-sort') || b.cells[colIndex].textContent || '';
          return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        });
        rows.forEach(function (r) { tbody.appendChild(r); });
      }

      headers.forEach(function (th) {
        th.addEventListener('click', function () {
          var col = parseInt(th.getAttribute('data-col'), 10);
          var dir = (sortState.col === col && sortState.dir === 'asc') ? 'desc' : 'asc';
          sortState = { col: col, dir: dir };
          headers.forEach(function (h) { h.classList.remove('asc', 'desc'); });
          th.classList.add(dir);
          sortTable(col, dir);
        });
      });

      // default: sort ascending by date
      headers[0].classList.add('asc');
      sortTable(0, 'asc');

      // filter
      var filterInput = document.getElementById('filterInput');
      var filterCount = document.getElementById('filterCount');
      var totalRows = tbody.querySelectorAll('tr').length;

      function applyFilter() {
        var term = filterInput.value.toLowerCase().trim();
        var rows = tbody.querySelectorAll('tr');
        var visible = 0;
        rows.forEach(function (row) {
          var text = row.textContent.toLowerCase();
          var show = !term || text.indexOf(term) !== -1;
          row.style.display = show ? '' : 'none';
          if (show) { visible++; }
        });
      }

      filterInput.addEventListener('input', applyFilter);
    })();
  </script>
</body>
</html>`;
  }
  /** HTML + ZIP end */

  /** xlsx + ZIP start */
  async exportToZip() {
    let allComments: Comment[];
    try {
      allComments = await this.commentService
        .getAllByApplicationId(this.application._id, 0, 1000000, null, { getDocuments: true }) // max 1M records
        .pipe(takeUntil(this.ngUnsubscribe))
        .toPromise();
    } catch (error) {
      console.log('error =', error);
      return;
    }

    const zip = new JSZip();
    const docFolder = zip.folder('documents');

    // Fetch application-level documents
    let appDocuments = [];
    try {
      appDocuments = await this.documentService
        .getAllByApplicationId(this.application._id)
        .pipe(takeUntil(this.ngUnsubscribe))
        .toPromise();
    } catch (e) {
      console.warn('Could not fetch application documents', e);
    }

    // Collect all documents to download (application-level + comment-level)
    const commentDocs = allComments.reduce((acc, comment) => acc.concat(comment.documents), []);
    const allDocs = [...appDocuments, ...commentDocs].filter(doc => !!doc._id);

    // Download all blobs in parallel
    await Promise.all(
      allDocs.map(async doc => {
        try {
          const blob = await this.api.getDocumentBlob(doc._id);
          docFolder.file(doc.documentFileName, blob);
        } catch (e) {
          console.warn(`Could not download document: ${doc.documentFileName}`, e);
        }
      })
    );

    // Flatten comments for Excel, mirroring exportToExcel() but adding a documentNames column
    const flatComments = allComments.map(comment => {
      const docNames = comment.documents
        .map(d => d.displayName || d.documentFileName)
        .join(', ');

      delete comment._commentPeriod;
      delete comment.commentNumber;
      comment.documents = [];
      // sanitize commentAuthor
      if (comment.commentAuthor) {
        delete comment.commentAuthor['isPublished'];
        delete comment.commentAuthor['_userId'];
        if (comment.commentAuthor['internal']) {
          delete comment.commentAuthor['internal']['isPublished'];
        }
      }
      // sanitize review
      if (comment.review) {
        delete comment.review['isPublished'];
        delete comment.review['_reviewerId'];
      }
      comment['cl_file'] = this.application.meta.clFile;
      comment['documentNames'] = docNames;
      return this.flatten_fastest(comment);
    });

    const excelFileName =
      'comments-' + this.application.meta.applicants.replace(/\s/g, '_') + moment(new Date()).format('-YYYYMMDD');
    const columnOrder: string[] = [
      'cl_file',
      '_id',
      '_addedBy',
      'dateAdded',
      'commentStatus',
      'isPublished',
      'review.reviewerDate',
      'review.reviewerNotes',
      'documentNames',
      'commentAuthor.contactName',
      'commentAuthor.orgName',
      'commentAuthor.location',
      'commentAuthor.requestedAnonymous',
      'commentAuthor.internal.email',
      'commentAuthor.internal.phone',
      'comment'
    ];

    const excelBuffer = this.exportService.exportAsExcelBuffer(flatComments, columnOrder);
    zip.file(`${excelFileName}.xlsx`, excelBuffer);

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, `${excelFileName}.zip`);
  }
  /** xlsx + ZIP end */

  //
  // flatten utilities
  // ref: https://stackoverflow.com/questions/19098797/fastest-way-to-flatten-un-flatten-nested-json-objects
  //

  // current fastest
  private flatten_fastest(data: object): object {
    const result = {};

    function recurse(cur: object, prop: string) {
      if (Object(cur) !== cur) {
        result[prop] = cur;
      } else if (Array.isArray(cur)) {
        const l = cur.length;
        for (let i = 0; i < l; i++) {
          recurse(cur[i], prop ? prop + '.' + i : '' + i);
        }
        if (l === 0) {
          // result[prop] = []; // ignore empty arrays
        }
      } else {
        let isEmpty = true;
        for (const p of Object.keys(cur)) {
          isEmpty = false;
          recurse(cur[p], prop ? prop + '.' + p : p);
        }
        if (isEmpty) {
          result[prop] = {};
        }
      }
    }

    recurse(data, '');
    return result;
  }

  // ES6 version
  // NB: doesn't return empty arrays
  private flatten_es6(obj: object, path: string = ''): object {
    if (!(obj instanceof Object)) {
      return { [path.replace(/\.$/g, '')]: obj };
    }
    return Object.keys(obj).reduce((output, key) => {
      return obj instanceof Array
        ? { ...output, ...this.flatten_es6(obj[key], path + '[' + key + '].') }
        : { ...output, ...this.flatten_es6(obj[key], path + key + '.') };
    }, {});
  }
}
