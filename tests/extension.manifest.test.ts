import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { MANIFEST_PATH, POPUP_HTML_PATH, POPUP_JS_PATH } from './helpers/chromeMock';

describe('Chrome Extension Manifest V3، بىخەتەرلىك ۋە RTL ئۆلچىمى', () => {
  it('manifest.json توغرا Manifest V3 ئۆلچىمى ۋە ئەڭ ئاز ئىجازەت پرىنسىپىغا ئۇيغۇن بولۇشى كېرەك', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as {
      manifest_version: number;
      name: string;
      version: string;
      permissions: string[];
      host_permissions?: string[];
      action: { default_popup: string; default_title: string };
      background: { service_worker: string };
      content_security_policy: { extension_pages: string };
    };

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('ئۆگىنىش قورالىم');
    expect(manifest.permissions).toEqual(['storage', 'notifications', 'alarms']);
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.permissions).not.toContain('<all_urls>');
    expect(manifest.permissions).not.toContain('tabs');
    expect(manifest.action.default_popup).toBe('popup.html');
    expect(manifest.background.service_worker).toBe('popup.js');

    const csp = manifest.content_security_policy.extension_pages;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'none'");
  });

  it('popup.html تولۇق RTL، ئۇيغۇرچە تىل بەلگىسى ۋە بارلىق كۆرۈنۈش بۆلەكلىرىگە ئىگە بولۇشى كېرەك', () => {
    const html = fs.readFileSync(POPUP_HTML_PATH, 'utf8');
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    expect(doc.documentElement.getAttribute('dir')).toBe('rtl');
    expect(doc.documentElement.getAttribute('lang')).toBe('ug');
    expect(doc.title).toBe('ئۆگىنىش قورالىم');

    // بارلىق 5 كۆرۈنۈشنىڭ مەۋجۇتلۇقى
    expect(doc.getElementById('viewHome')).not.toBeNull();
    expect(doc.getElementById('viewStudy')).not.toBeNull();
    expect(doc.getElementById('viewVocab')).not.toBeNull();
    expect(doc.getElementById('viewReminders')).not.toBeNull();
    expect(doc.getElementById('viewAdd')).not.toBeNull();

    // تاشقى CDN ياكى سىرتقى سىكرىپت ئۇلىنىشى يوقلۇقى
    const externalScripts = Array.from(doc.querySelectorAll('script[src]')).filter((s) =>
      /^https?:\/\//i.test(s.getAttribute('src') || '')
    );
    const externalLinks = Array.from(doc.querySelectorAll('link[href]')).filter((l) =>
      /^https?:\/\//i.test(l.getAttribute('href') || '')
    );
    expect(externalScripts).toHaveLength(0);
    expect(externalLinks).toHaveLength(0);
  });

  it('قىستۇرما كودى نۆل ئىز قوغلاش، چەكلەنگەن ئاتالغۇسىز ۋە innerHTML سىز بولۇشى كېرەك', () => {
    const js = fs.readFileSync(POPUP_JS_PATH, 'utf8');
    const html = fs.readFileSync(POPUP_HTML_PATH, 'utf8');
    const manifest = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const combined = `${manifest}\n${html}\n${js}`;

    // چەكلەنگەن ئاتالغۇلار ۋە تاشقى ئانالىز/شىركەت ئىزلىرى
    expect(combined).not.toMatch(/جۇڭگو|شىنجاڭ|شىنلاڭ|خەنزۇ/);
    expect(combined).not.toMatch(/google-analytics|googletagmanager|baidu|tencent|alibaba/i);
    expect(combined).not.toMatch(/TODO|FIXME|كېيىن يازسىڭىز بولىدۇ/);

    // XSS مۇداپىئەسى: popup.js دا innerHTML ئىشلىتىلمەيدۇ
    expect(js).not.toContain('innerHTML');
    expect(js).not.toContain('outerHTML');
    expect(js).not.toContain('document.write');
  });
});
