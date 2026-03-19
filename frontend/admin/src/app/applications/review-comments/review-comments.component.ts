import { Component, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Subject } from 'rxjs'
import { takeUntil } from 'rxjs/operators'
import * as moment from 'moment'
import * as _ from 'lodash'
import * as JSZip from 'jszip'
import { saveAs } from 'file-saver'

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

import { Application } from 'app/models/application'
import { Comment } from 'app/models/comment'
import { ApiService } from 'app/services/api'
import { CommentService } from 'app/services/comment.service'
import { DocumentService } from 'app/services/document.service'
import { ExportService } from 'app/services/export.service'

class SortKey {
  innerHTML: string
  value: string
}

@Component({
  selector: 'app-review-comments',
  templateUrl: './review-comments.component.html',
  styleUrls: ['./review-comments.component.scss'],
})
export class ReviewCommentsComponent implements OnInit, OnDestroy {
  readonly PAGE_SIZE = 20

  @ViewChild('commentListScrollContainer', { read: ElementRef })
  public commentListScrollContainer: ElementRef

  readonly sortKeys: SortKey[] = [
    { innerHTML: 'Oldest', value: '%2BdateAdded' },
    { innerHTML: 'Newest', value: '-dateAdded' },
    { innerHTML: 'Name (A-Z)', value: '%2BcontactName' },
    { innerHTML: 'Name (Z-A)', value: '-contactName' },
  ]

  public loading = false
  public application: Application = null
  public comments: Comment[] = []
  public alerts: string[] = []
  public currentComment: Comment
  public pageCount = 1 // in case getCount() fails
  public pageNum = 1 // first page
  public sortBy = this.sortKeys[1].value // initial sort is by descending date
  public includeAttachments = true

  // see official solution:
  // https://stackoverflow.com/questions/38008334/angular-rxjs-when-should-i-unsubscribe-from-subscription
  // or http://brianflove.com/2016/12/11/anguar-2-unsubscribe-observables/
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>()

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private commentService: CommentService,
    private documentService: DocumentService,
    private exportService: ExportService,
  ) {}

  ngOnInit() {
    // get data from route resolver
    this.route.data
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((data: { application: Application }) => {
        if (data.application) {
          this.application = data.application

          this.commentService
            .getCountByPeriodId(this.application.meta.currentPeriod._id)
            .pipe(takeUntil(this.ngUnsubscribe))
            .subscribe((value) => {
              this.pageCount = value ? Math.ceil(value / this.PAGE_SIZE) : 1
              // get initial data
              this.getData()
            })
        } else {
          alert("Uh-oh, couldn't load application")
          // application not found --> navigate back to search
          this.router.navigate(['/search'])
        }
      })
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next()
    this.ngUnsubscribe.complete()
  }

  getData() {
    if (this.application) {
      // safety check
      this.loading = true
      this.commentListScrollContainer.nativeElement.scrollTop = 0

      // get a page of comments
      this.commentService
        .getAllByApplicationId(
          this.application._id,
          this.pageNum - 1,
          this.PAGE_SIZE,
          this.sortBy,
          {
            getDocuments: true,
          },
        )
        .pipe(takeUntil(this.ngUnsubscribe))
        .subscribe(
          (comments) => {
            this.loading = false
            this.comments = comments

            // pre-select the first comment
            if (this.comments.length > 0) {
              this.setCurrentComment(this.comments[0])
            }
          },
          (error) => {
            this.loading = false
            // if 403, redir to login page
            if (error && error.status === 403) {
              this.router.navigate(['/login'])
            }
            this.alerts.push('Error loading comments')
          },
        )
    }
  }

  prevPage() {
    this.pageNum--
    this.getData()
  }

  nextPage() {
    this.pageNum++
    this.getData()
  }

  setCurrentComment(item: Comment) {
    const index = _.findIndex(this.comments, { _id: item._id })
    if (index >= 0) {
      this.comments.splice(index, 1, item)
      this.currentComment = item
    }
  }

  isCurrentComment(item: Comment): boolean {
    return item === this.currentComment
  }

  exportToExcel() {
    // get all comments
    this.commentService
      .getAllByApplicationId(this.application._id, 0, 1000000, null, { getDocuments: true }) // max 1M records
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(
        (comments) => {
          // FUTURE: instead of flattening, copy to new 'export object' with user-friendly keys?
          const flatComments = comments.map((comment) => {
            // sanitize and flatten each comment object
            delete comment._commentPeriod
            delete comment.commentNumber
            // sanitize commentAuthor
            if (comment.commentAuthor) {
              delete comment.commentAuthor['isPublished']
              delete comment.commentAuthor['_userId']
              if (comment.commentAuthor['internal']) {
                delete comment.commentAuthor['internal']['isPublished']
              }
            }
            // sanitize review
            if (comment.review) {
              delete comment.review['isPublished']
              delete comment.review['_reviewerId']
            }
            // sanitize documents
            comment.documents.forEach((document) => {
              delete document._id
              delete document._addedBy
              delete document._application
              delete document._decision
              delete document._comment
              delete document.internalURL
              delete document.internalMime
              delete document.isDeleted
              delete document.meta
            })
            // add necessary properties
            // comment.applicants = this.application.meta.applicants; // FUTURE
            comment['cl_file'] = this.application.meta.clFile
            return this.flatten_fastest(comment)
          })

          const excelFileName =
            'comments-' +
            this.application.meta.applicants.replace(/\s/g, '_') +
            moment(new Date()).format('-YYYYMMDD')
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
            'comment',
          ]
          this.exportService.exportAsExcelFile(flatComments, excelFileName, columnOrder)
        },
        (error) => console.log('error =', error),
      )
  }

  /** HTML + ZIP start */
  async exportToHtmlZip() {
    let allComments: Comment[]
    try {
      allComments = await this.commentService
        .getAllByApplicationId(this.application._id, 0, 1000000, '%2BdateAdded', {
          getDocuments: true,
        }) // max 1M records, oldest first
        .pipe(takeUntil(this.ngUnsubscribe))
        .toPromise()
    } catch (error) {
      console.log('error =', error)
      return
    }

    const zip = new JSZip()
    const docFolder = zip.folder('documents')

    // Fetch application-level documents
    let appDocuments = []
    try {
      appDocuments = await this.documentService
        .getAllByApplicationId(this.application._id)
        .pipe(takeUntil(this.ngUnsubscribe))
        .toPromise()
    } catch (e) {
      console.warn('Could not fetch application documents', e)
    }

    // Collect all documents to download (application-level + comment-level)
    const commentDocs = allComments.reduce((acc, comment) => acc.concat(comment.documents), [])
    const allDocs = [...appDocuments, ...commentDocs].filter((doc) => !!doc._id)

    // Download all blobs in parallel
    await Promise.all(
      allDocs.map(async (doc) => {
        try {
          const blob = await this.api.getDocumentBlob(doc._id)
          docFolder.file(doc.documentFileName, blob)
        } catch (e) {
          console.warn(`Could not download document: ${doc.documentFileName}`, e)
        }
      }),
    )

    const htmlContent = this.generateHtmlReport(allComments)
    const baseName =
      'comments-' +
      this.application.meta.applicants.replace(/\s/g, '_') +
      moment(new Date()).format('-YYYYMMDD')
    zip.file(`${baseName}.html`, htmlContent)

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    saveAs(zipBlob, `${baseName}.zip`)
  }

  private generateHtmlReport(comments: Comment[]): string {
    const app = this.application
    const periodStart =
      app.meta.currentPeriod && app.meta.currentPeriod.startDate
        ? new Date(app.meta.currentPeriod.startDate).toLocaleDateString('en-CA')
        : '—'
    const periodEnd =
      app.meta.currentPeriod && app.meta.currentPeriod.endDate
        ? new Date(app.meta.currentPeriod.endDate).toLocaleDateString('en-CA')
        : '—'

    const escHtml = (val: any): string => {
      if (val == null) {
        return '—'
      }
      return String(val)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    }

    const rows = comments
      .map((c) => {
        const author = c.commentAuthor
        const inlineExts = /\.(pdf|jpg|jpeg|png|gif|webp|svg|bmp|tiff?|mp4|webm|mp3|wav|ogg)$/i
        const docNames =
          c.documents && c.documents.length
            ? c.documents
                .map((d) => {
                  const label = escHtml(d.displayName || d.documentFileName)
                  if (inlineExts.test(d.documentFileName)) {
                    const href = 'documents/' + encodeURIComponent(d.documentFileName)
                    return `<a href="${href}" target="_blank">${label}</a>`
                  }
                  return label
                })
                .join('<br>')
            : '—'
        const dateRaw = c.dateAdded ? new Date(c.dateAdded).toISOString() : ''
        const dateDisplay = c.dateAdded ? new Date(c.dateAdded).toLocaleDateString('en-CA') : '—'
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
        </tr>`
      })
      .join('\n')

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
    @media print {
      body { background: #fff; padding: 0; }
      .filter-bar { display: none; }
      .generated { display: none; }
      .table-wrapper { overflow: visible; }
      table.comments thead th { background: #003366 !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      table.comments tbody tr:nth-child(even) { background: #f0f4f8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="app-info">
    <h1>Comments – Crown Land File: ${escHtml(app.meta.clFile)}</h1>
    <table>
      <tr><td>Applicant(s):</td><td>${escHtml(app.meta.applicants)}</td></tr>
      <tr><td>Purpose / Subpurpose:</td><td>${escHtml(app.purpose)} / ${escHtml(
      app.subpurpose,
    )}</td></tr>
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
</html>`
  }
  /** HTML + ZIP end */

  onExportExcel() {
    if (this.includeAttachments) {
      this.exportToZip()
    } else {
      this.exportToExcel()
    }
  }

  onExportPdf() {
    if (this.includeAttachments) {
      this.exportToPdf()
    } else {
      this.exportToPdfOnly()
    }
  }

  /** PDF only (no attachments) */
  async exportToPdfOnly() {
    let allComments: Comment[]
    try {
      allComments = await this.commentService
        .getAllByApplicationId(this.application._id, 0, 1000000, '%2BdateAdded', {
          getDocuments: true,
        })
        .pipe(takeUntil(this.ngUnsubscribe))
        .toPromise()
    } catch (error) {
      console.log('error =', error)
      return
    }

    const app = this.application

    const periodStart =
      app.meta.currentPeriod && app.meta.currentPeriod.startDate
        ? new Date(app.meta.currentPeriod.startDate).toLocaleDateString('en-CA')
        : '\u2014'
    const periodEnd =
      app.meta.currentPeriod && app.meta.currentPeriod.endDate
        ? new Date(app.meta.currentPeriod.endDate).toLocaleDateString('en-CA')
        : '\u2014'

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const margin = 14
    const pageWidth = doc.internal.pageSize.getWidth()
    const contentWidth = pageWidth - margin * 2

    doc.setFontSize(16)
    doc.setTextColor(0, 51, 102)
    doc.text('Comments \u2013 Crown Land File: ' + (app.meta.clFile || '\u2014'), margin, 16)

    autoTable(doc, {
      startY: 22,
      body: [
        ['Applicant(s):', app.meta.applicants || '\u2014'],
        ['Purpose / Subpurpose:', (app.purpose || '\u2014') + ' / ' + (app.subpurpose || '\u2014')],
        ['Type / Subtype:', (app.type || '\u2014') + ' / ' + (app.subtype || '\u2014')],
        ['Location:', app.location || '\u2014'],
        ['Description:', app.description || '\u2014'],
        ['Comment Period:', periodStart + ' \u2013 ' + periodEnd],
        ['Total Comments:', allComments.length],
      ],
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50, textColor: [80, 80, 80] as any },
        1: { cellWidth: 'auto' },
      },
      theme: 'plain',
      styles: { fontSize: 10 },
      margin: { left: margin, right: margin },
    })

    const labelColW = 36
    const valueColW = (contentWidth - labelColW * 2) / 2
    const labelStyle = {
      fontStyle: 'bold' as any,
      fillColor: [240, 244, 248] as any,
      textColor: [60, 60, 60] as any,
    }

    const estimateCardHeight = (c: Comment): number => {
      const cellPad = 3
      const tableFontSizeMm = (9 * 25.4) / 72
      const lineH = tableFontSizeMm * 1.15
      const fixedRowH = lineH + cellPad * 2
      const fixedRowsTotal = 5 * fixedRowH
      const commentCellInnerW = valueColW + labelColW + valueColW - cellPad * 2
      doc.setFontSize(9)
      const lines: string[] = doc.splitTextToSize(c.comment || '\u2014', commentCellInnerW)
      const commentRowH = Math.max(18, lines.length * lineH + cellPad * 2)
      const headerH = 10
      return headerH + fixedRowsTotal + commentRowH
    }

    allComments.forEach((c, i) => {
      const author = c.commentAuthor
      const dateStr = c.dateAdded ? new Date(c.dateAdded).toLocaleDateString('en-CA') : '\u2014'
      const anonStr = author && author.requestedAnonymous ? 'Yes' : 'No'
      const docNames =
        c.documents && c.documents.length
          ? c.documents.map((d: any) => `${i + 1}_${d.documentFileName}`).join('\n')
          : '\u2014'

      let cardY: number = (doc as any).lastAutoTable.finalY + (i === 0 ? 10 : 16)
      let newPage = false

      if (i > 0) {
        const pageH = doc.internal.pageSize.getHeight()
        const remaining = pageH - cardY - 16
        const needed = estimateCardHeight(c)
        if (needed > remaining) {
          doc.addPage()
          cardY = margin + 6
          newPage = true
        }
      }

      if (i > 0 && !newPage) {
        doc.setDrawColor(180, 180, 180)
        doc.setLineWidth(0.3)
        doc.line(margin, cardY - 8, pageWidth - margin, cardY - 8)
      }

      doc.setFontSize(10)
      doc.setTextColor(0, 51, 102)
      doc.setFont(undefined, 'bold')
      doc.text(`Comment #${i + 1}`, margin, cardY)
      doc.setFont(undefined, 'normal')

      autoTable(doc, {
        startY: cardY + 4,
        body: [
          [
            { content: 'Contact Name', styles: labelStyle },
            (author && author.contactName) || '\u2014',
            { content: 'Date', styles: labelStyle },
            dateStr,
          ],
          [
            { content: 'Organization', styles: labelStyle },
            (author && author.orgName) || '\u2014',
            { content: 'Anonymous', styles: labelStyle },
            anonStr,
          ],
          [
            { content: 'Location', styles: labelStyle },
            (author && author.location) || '\u2014',
            { content: 'Status', styles: labelStyle },
            c.commentStatus || '\u2014',
          ],
          [
            { content: 'Email', styles: labelStyle },
            (author && author.internal && author.internal.email) || '\u2014',
            { content: 'Reviewer Notes', styles: labelStyle },
            (c.review && c.review.reviewerNotes) || '\u2014',
          ],
          [
            { content: 'Phone', styles: labelStyle },
            (author && author.internal && author.internal.phone) || '\u2014',
            { content: 'Attachments', styles: labelStyle },
            docNames,
          ],
          [
            { content: 'Comment', styles: labelStyle },
            { content: c.comment || '\u2014', colSpan: 3, styles: { minCellHeight: 18 } },
          ],
        ],
        columnStyles: {
          0: { cellWidth: labelColW },
          1: { cellWidth: valueColW },
          2: { cellWidth: labelColW },
          3: { cellWidth: valueColW },
        },
        theme: 'grid',
        styles: { fontSize: 9, overflow: 'linebreak', cellPadding: 3 },
        margin: { left: margin, right: margin },
        pageBreak: 'avoid',
      })
    })

    const totalPages: number = (doc as any).internal.getNumberOfPages()
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setFontSize(9)
    doc.setTextColor(130, 130, 130)
    doc.setFont(undefined, 'normal')
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p)
      doc.text(`Page ${p} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' })
    }

    const baseName =
      'comments-' + app.meta.applicants.replace(/\s/g, '_') + moment(new Date()).format('-YYYYMMDD')
    doc.save(`${baseName}.pdf`)
  }
  /** PDF only end */

  /** Print to PDF start */
  async exportToPdf() {
    let allComments: Comment[]
    try {
      allComments = await this.commentService
        .getAllByApplicationId(this.application._id, 0, 1000000, '%2BdateAdded', {
          getDocuments: true,
        })
        .pipe(takeUntil(this.ngUnsubscribe))
        .toPromise()
    } catch (error) {
      console.log('error =', error)
      return
    }

    const zip = new JSZip()
    const docFolder = zip.folder('documents')

    // Fetch application-level documents
    let appDocuments = []
    try {
      appDocuments = await this.documentService
        .getAllByApplicationId(this.application._id)
        .pipe(takeUntil(this.ngUnsubscribe))
        .toPromise()
    } catch (e) {
      console.warn('Could not fetch application documents', e)
    }

    // Download application-level documents (no prefix)
    await Promise.all(
      appDocuments.filter((doc) => !!doc._id).map(async (doc) => {
        try {
          const blob = await this.api.getDocumentBlob(doc._id)
          docFolder.file(doc.documentFileName, blob)
        } catch (e) {
          console.warn(`Could not download document: ${doc.documentFileName}`, e)
        }
      }),
    )

    // Download comment-level documents with comment number prefix
    await Promise.all(
      allComments.reduce((acc, comment, idx) => {
        return acc.concat(
          comment.documents
            .filter((doc) => !!doc._id)
            .map(async (doc) => {
              try {
                const blob = await this.api.getDocumentBlob(doc._id)
                docFolder.file(`${idx + 1}_${doc.documentFileName}`, blob)
              } catch (e) {
                console.warn(`Could not download document: ${doc.documentFileName}`, e)
              }
            }),
        )
      }, [] as Promise<void>[]),
    )

    const app = this.application

    const periodStart =
      app.meta.currentPeriod && app.meta.currentPeriod.startDate
        ? new Date(app.meta.currentPeriod.startDate).toLocaleDateString('en-CA')
        : '\u2014'
    const periodEnd =
      app.meta.currentPeriod && app.meta.currentPeriod.endDate
        ? new Date(app.meta.currentPeriod.endDate).toLocaleDateString('en-CA')
        : '\u2014'

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const margin = 14
    const pageWidth = doc.internal.pageSize.getWidth()
    const contentWidth = pageWidth - margin * 2

    // Title
    doc.setFontSize(16)
    doc.setTextColor(0, 51, 102)
    doc.text('Comments – Crown Land File: ' + (app.meta.clFile || '—'), margin, 16)

    // Application info block
    autoTable(doc, {
      startY: 22,
      body: [
        ['Applicant(s):', app.meta.applicants || '—'],
        ['Purpose / Subpurpose:', (app.purpose || '—') + ' / ' + (app.subpurpose || '—')],
        ['Type / Subtype:', (app.type || '—') + ' / ' + (app.subtype || '—')],
        ['Location:', app.location || '—'],
        ['Description:', app.description || '—'],
        ['Comment Period:', periodStart + ' – ' + periodEnd],
        ['Total Comments:', allComments.length],
      ],
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50, textColor: [80, 80, 80] as any },
        1: { cellWidth: 'auto' },
      },
      theme: 'plain',
      styles: { fontSize: 10 },
      margin: { left: margin, right: margin },
    })

    // Per-comment cards: 4 columns — label | value | label | value
    // Two label columns share a fixed width; value columns split the remainder equally.
    const labelColW = 36
    const valueColW = (contentWidth - labelColW * 2) / 2
    const labelStyle = {
      fontStyle: 'bold' as any,
      fillColor: [240, 244, 248] as any,
      textColor: [60, 60, 60] as any,
    }
    const linkStyle = { textColor: [0, 0, 204] as any }

    // Estimate the rendered height of a comment card before drawing it.
    // Uses splitTextToSize to measure how many lines the comment text wraps into so the
    // page-break decision is accurate regardless of comment length.
    const estimateCardHeight = (c: Comment): number => {
      const cellPad = 3 // matches cellPadding in styles
      const tableFontSizeMm = (9 * 25.4) / 72 // 9pt → mm
      const lineH = tableFontSizeMm * 1.15 // line-height factor

      // Five fixed single-line rows (Contact Name / Date, Organisation / Anonymous,
      // Location / Status, Email / Reviewer Notes, Phone / Attachments)
      const fixedRowH = lineH + cellPad * 2
      const fixedRowsTotal = 5 * fixedRowH

      // Comment row spans columns 1-3: valueColW + labelColW + valueColW
      const commentCellInnerW = valueColW + labelColW + valueColW - cellPad * 2
      doc.setFontSize(9)
      const lines: string[] = doc.splitTextToSize(c.comment || '—', commentCellInnerW)
      const commentRowH = Math.max(18, lines.length * lineH + cellPad * 2)

      // 6 mm for "Comment #N" header text + 4 mm gap to table top
      const headerH = 10
      return headerH + fixedRowsTotal + commentRowH
    }

    allComments.forEach((c, i) => {
      const author = c.commentAuthor
      const dateStr = c.dateAdded ? new Date(c.dateAdded).toLocaleDateString('en-CA') : '\u2014'
      const anonStr = author && author.requestedAnonymous ? 'Yes' : 'No'
      const docNames =
        c.documents && c.documents.length
          ? c.documents.map((d: any) => `${i + 1}_${d.documentFileName}`).join('\n')
          : '\u2014'

      let cardY: number = (doc as any).lastAutoTable.finalY + (i === 0 ? 10 : 16)
      let newPage = false

      // Decide whether the next comment card fits in the remaining page space.
      // We reserve 16 mm for the between-comment gap / divider and bottom margin.
      if (i > 0) {
        const pageH = doc.internal.pageSize.getHeight()
        const remaining = pageH - cardY - 16
        const needed = estimateCardHeight(c)
        if (needed > remaining) {
          doc.addPage()
          cardY = margin + 6
          newPage = true
        }
      }

      // Divider line above each comment (skip first and when starting a new page)
      if (i > 0 && !newPage) {
        doc.setDrawColor(180, 180, 180)
        doc.setLineWidth(0.3)
        doc.line(margin, cardY - 8, pageWidth - margin, cardY - 8)
      }

      // Comment # header
      doc.setFontSize(10)
      doc.setTextColor(0, 51, 102)
      doc.setFont(undefined, 'bold')
      doc.text(`Comment #${i + 1}`, margin, cardY)
      doc.setFont(undefined, 'normal')

      autoTable(doc, {
        startY: cardY + 4,
        body: [
          [
            { content: 'Contact Name', styles: labelStyle },
            (author && author.contactName) || '—',
            { content: 'Date', styles: labelStyle },
            dateStr,
          ],
          [
            { content: 'Organization', styles: labelStyle },
            (author && author.orgName) || '—',
            { content: 'Anonymous', styles: labelStyle },
            anonStr,
          ],
          [
            { content: 'Location', styles: labelStyle },
            (author && author.location) || '—',
            { content: 'Status', styles: labelStyle },
            c.commentStatus || '—',
          ],
          [
            { content: 'Email', styles: labelStyle },
            (author && author.internal && author.internal.email) || '—',
            { content: 'Reviewer Notes', styles: labelStyle },
            (c.review && c.review.reviewerNotes) || '—',
          ],
          [
            { content: 'Phone', styles: labelStyle },
            (author && author.internal && author.internal.phone) || '—',
            { content: 'Attachments', styles: labelStyle },
            { content: docNames, styles: linkStyle },
          ],
          [
            { content: 'Comment', styles: labelStyle },
            { content: c.comment || '—', colSpan: 3, styles: { minCellHeight: 18 } },
          ],
        ],
        columnStyles: {
          0: { cellWidth: labelColW },
          1: { cellWidth: valueColW },
          2: { cellWidth: labelColW },
          3: { cellWidth: valueColW },
        },
        theme: 'grid',
        styles: { fontSize: 9, overflow: 'linebreak', cellPadding: 3 },
        margin: { left: margin, right: margin },
        pageBreak: 'avoid',
        didDrawCell: ({ row, column, cell, doc }) => {
          // Attachments cell: row 4, column 3 (value column after "Attachments" label)
          if (row.index !== 4 || column.index !== 3 || !c.documents || !c.documents.length) return

          const pad = 3 // matches cellPadding in styles above
          const lineH = ((9 * 25.4) / 72) * 1.15 // 9pt → mm with line-height factor

          c.documents.forEach((d: any, idx: number) => {
            doc.link(cell.x + pad, cell.y + pad + idx * lineH, cell.width - pad * 2, lineH, {
              url: 'documents/' + encodeURIComponent(`${i + 1}_${d.documentFileName}`),
            })
          })
        },
      })
    })

    // Page numbers
    const totalPages: number = (doc as any).internal.getNumberOfPages()
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setFontSize(9)
    doc.setTextColor(130, 130, 130)
    doc.setFont(undefined, 'normal')
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p)
      doc.text(`Page ${p} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' })
    }

    const baseName =
      'comments-' + app.meta.applicants.replace(/\s/g, '_') + moment(new Date()).format('-YYYYMMDD')
    zip.file(`${baseName}.pdf`, doc.output('arraybuffer'))

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    saveAs(zipBlob, `${baseName}.zip`)
  }
  /** Print to PDF end */

  /** xlsx + ZIP start */
  async exportToZip() {
    let allComments: Comment[]
    try {
      allComments = await this.commentService
        .getAllByApplicationId(this.application._id, 0, 1000000, null, { getDocuments: true }) // max 1M records
        .pipe(takeUntil(this.ngUnsubscribe))
        .toPromise()
    } catch (error) {
      console.log('error =', error)
      return
    }

    const zip = new JSZip()
    const docFolder = zip.folder('documents')

    // Fetch application-level documents
    let appDocuments = []
    try {
      appDocuments = await this.documentService
        .getAllByApplicationId(this.application._id)
        .pipe(takeUntil(this.ngUnsubscribe))
        .toPromise()
    } catch (e) {
      console.warn('Could not fetch application documents', e)
    }

    // Collect all documents to download (application-level + comment-level)
    const commentDocs = allComments.reduce((acc, comment) => acc.concat(comment.documents), [])
    const allDocs = [...appDocuments, ...commentDocs].filter((doc) => !!doc._id)

    // Download all blobs in parallel
    await Promise.all(
      allDocs.map(async (doc) => {
        try {
          const blob = await this.api.getDocumentBlob(doc._id)
          docFolder.file(doc.documentFileName, blob)
        } catch (e) {
          console.warn(`Could not download document: ${doc.documentFileName}`, e)
        }
      }),
    )

    // Flatten comments for Excel, mirroring exportToExcel() but adding a documentNames column
    const flatComments = allComments.map((comment) => {
      const docNames = comment.documents.map((d) => d.displayName || d.documentFileName).join(', ')

      delete comment._commentPeriod
      delete comment.commentNumber
      comment.documents = []
      // sanitize commentAuthor
      if (comment.commentAuthor) {
        delete comment.commentAuthor['isPublished']
        delete comment.commentAuthor['_userId']
        if (comment.commentAuthor['internal']) {
          delete comment.commentAuthor['internal']['isPublished']
        }
      }
      // sanitize review
      if (comment.review) {
        delete comment.review['isPublished']
        delete comment.review['_reviewerId']
      }
      comment['cl_file'] = this.application.meta.clFile
      comment['documentNames'] = docNames
      return this.flatten_fastest(comment)
    })

    const excelFileName =
      'comments-' +
      this.application.meta.applicants.replace(/\s/g, '_') +
      moment(new Date()).format('-YYYYMMDD')
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
      'comment',
    ]

    const excelBuffer = this.exportService.exportAsExcelBuffer(flatComments, columnOrder)
    zip.file(`${excelFileName}.xlsx`, excelBuffer)

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    saveAs(zipBlob, `${excelFileName}.zip`)
  }
  /** xlsx + ZIP end */

  //
  // flatten utilities
  // ref: https://stackoverflow.com/questions/19098797/fastest-way-to-flatten-un-flatten-nested-json-objects
  //

  // current fastest
  private flatten_fastest(data: object): object {
    const result = {}

    function recurse(cur: object, prop: string) {
      if (Object(cur) !== cur) {
        result[prop] = cur
      } else if (Array.isArray(cur)) {
        const l = cur.length
        for (let i = 0; i < l; i++) {
          recurse(cur[i], prop ? prop + '.' + i : '' + i)
        }
        if (l === 0) {
          // result[prop] = []; // ignore empty arrays
        }
      } else {
        let isEmpty = true
        for (const p of Object.keys(cur)) {
          isEmpty = false
          recurse(cur[p], prop ? prop + '.' + p : p)
        }
        if (isEmpty) {
          result[prop] = {}
        }
      }
    }

    recurse(data, '')
    return result
  }

  // ES6 version
  // NB: doesn't return empty arrays
  private flatten_es6(obj: object, path: string = ''): object {
    if (!(obj instanceof Object)) {
      return { [path.replace(/\.$/g, '')]: obj }
    }
    return Object.keys(obj).reduce((output, key) => {
      return obj instanceof Array
        ? { ...output, ...this.flatten_es6(obj[key], path + '[' + key + '].') }
        : { ...output, ...this.flatten_es6(obj[key], path + key + '.') }
    }, {})
  }
}
