import { Commit } from './github.js';
import { getConventionalImpact } from './conventional_commits.js';
import { Impact } from './semver.js';

function getReleaseNoteSection(title: string, commits: Commit[]): string[] {
  const lines: string[] = [];
  lines.push(`##${title} \n`);
  for (const commit of commits) {
    lines.push(`- ${commit.title} (${commit.sha.slice(0, 7)})`);
  }
  lines.push('');
  return lines;
}

// Given a list of commits that have not been released yet, generate release notes.
export function generateReleaseNotes(commits: Commit[]): string {
  const breaking: Commit[] = [];
  const features: Commit[] = [];
  const fixes: Commit[] = [];
  const others: Commit[] = [];

  for (const commit of commits) {
    const commit_impact = getConventionalImpact(commit.title, commit.body);
    switch (commit_impact) {
      case Impact.MAJOR:
        breaking.push(commit);
        break;
      case Impact.MINOR:
        features.push(commit);
        break;
      case Impact.PATCH:
        fixes.push(commit);
        break;
      default:
        others.push(commit);
        break;
    }
  }

  const lines: string[] = [];
  lines.push('# Release Notes');
  if (breaking.length > 0) {
    lines.push(...getReleaseNoteSection('Breaking Changes', breaking));
  }
  if (features.length > 0) {
    lines.push(...getReleaseNoteSection('New Features', features));
  }
  if (fixes.length > 0) {
    lines.push(...getReleaseNoteSection('Bug Fixes', fixes));
  }
  if (others.length > 0) {
    lines.push(...getReleaseNoteSection('Other Changes', others));
  }
  lines.push('');
  return lines.join('\n');
}
