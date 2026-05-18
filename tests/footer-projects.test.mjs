import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('projects footer', () => {
  it('matches the AlonSoftware projects footer links', () => {
    const footer = readText('src/components/Footer.astro');
    const footerProjects = readText('src/i18n/footer-projects.ts');

    assert.match(footer, /site-footer__brand/);
    assert.match(footer, /site-footer__projects/);
    assert.match(footer, /footerTools/);
    assert.match(footer, /footerGames/);
    assert.match(footer, /new URL\(project\.href\)\.hostname/);
    assert.match(footer, /target=\"_blank\"/);
    assert.match(footer, /rel=\"noopener noreferrer\"/);

    assert.match(footerProjects, /Más herramientas y juegos de AlonSoftware/);
    assert.match(footerProjects, /FácilPDF/);
    assert.match(footerProjects, /https:\/\/facilpdf\.alon\.one/);
    assert.match(footerProjects, /FacilIMG/);
    assert.match(footerProjects, /https:\/\/facilimg\.alon\.one/);
    assert.match(footerProjects, /Print a Calendar/);
    assert.match(footerProjects, /https:\/\/printacalendar\.alon\.one/);
    assert.match(footerProjects, /HitYear/);
    assert.match(footerProjects, /https:\/\/hityear\.alon\.one/);
    assert.match(footerProjects, /Democrazy/);
    assert.match(footerProjects, /https:\/\/democrazy\.alon\.one/);
    assert.match(footerProjects, /Hamster Run/);
    assert.match(footerProjects, /https:\/\/hamsterrun\.alon\.one/);
    assert.match(footerProjects, /Mundial de fútbol 2026/);
    assert.match(footerProjects, /https:\/\/mundial2026\.alon\.one/);
  });
});
