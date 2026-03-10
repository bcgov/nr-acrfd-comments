import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Parser } from 'json2csv';

/**
 * Service to generate and download an excel or csv file.
 *
 * @export
 * @class ExportService
 */
@Injectable()
export class ExportService {
  constructor() {}

  /**
   * Generates and downloads the given data as an excel file.
   *
   * @param {any[]} data array of flattened objects
   * @param {string} fileName file name, not including extension
   * @param {string[]} [columns=[]] data fields to include in excel, in order
   * @memberof ExportService
   */
  public exportAsExcelFile(data: any[], fileName: string, columns: string[] = []): void {
    const json_opts: XLSX.JSON2SheetOpts = { header: columns };
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data, json_opts);
    const workbook: XLSX.WorkBook = { Sheets: { data: worksheet }, SheetNames: ['data'] };
    const write_opts: XLSX.WritingOptions = { bookType: 'xlsx' };
    XLSX.writeFile(workbook, `${fileName}.xlsx`, write_opts);
  }

  /**
   * Generates the given data as an xlsx workbook and returns it as an ArrayBuffer.
   * Useful for embedding in a ZIP archive instead of directly triggering a download.
   *
   * @param {any[]} data array of flattened objects
   * @param {string[]} [columns=[]] data fields to include in excel, in order
   * @returns {ArrayBuffer}
   * @memberof ExportService
   */
  public exportAsExcelBuffer(data: any[], columns: string[] = []): ArrayBuffer {
    const json_opts: XLSX.JSON2SheetOpts = { header: columns };
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data, json_opts);
    const workbook: XLSX.WorkBook = { Sheets: { data: worksheet }, SheetNames: ['data'] };
    const write_opts: XLSX.WritingOptions = { bookType: 'xlsx', type: 'array' };
    return XLSX.write(workbook, write_opts) as ArrayBuffer;
  }

  /**
   * Generates and downloads the given data as a csv file.
   *
   * @param {any[]} data array of objects
   * @param {string} fileName file name, not including extension
   * @param {string[]} [fields=[]] data fields include in csv, in order
   * @memberof ExportService
   */
  public exportAsCSV(data: any[], fileName: string, fields: any[] = []): void {
    const csvData: string = new Parser({ fields: fields }).parse(data);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `${fileName}.csv`);
  }
}
