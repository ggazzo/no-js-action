import * as core from '@actions/core';
import * as github from '@actions/github';
import { Octokit } from '@octokit/action';
import minimatch from 'minimatch';

const { GITHUB_REPOSITORY = '', GITHUB_REF = '' } = process.env;

const [owner, repo] = GITHUB_REPOSITORY.split('/');
const issue_number = GITHUB_REF.split('/')[2];
const configPath = core.getInput('configuration-path');

const octokit = new Octokit();

async function getJSON(repoPath: string) {
  const response = await octokit.repos.getContent({
    owner,
    repo,
    path: repoPath,
    ref: github.context.sha,
  });

  return JSON.parse(
    Buffer.from(
      (response.data as any).content,
      (response.data as any).encoding
    ).toString()
  );
}

async function run(): Promise<void> {
  try {
    const files = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: parseInt(issue_number),
    });

    const { added } = await getJSON(configPath);

    const invalidFiles = files.data
      .filter((file: { status: string; filename: any }) => {
        if (file.status !== 'added') {
          return false;
        }
        if (
          Array.isArray(added.ignore) &&
          added.ignore.some((ignore: string) =>
            minimatch(file.filename, ignore)
          )
        ) {
          return false;
        }

        return (
          minimatch(file.filename, '**/*.js') ||
          minimatch(file.filename, '**/*.jsx')
        );
      })
      .map((file) => file.filename);
    if (invalidFiles.length > 0) {
      const js = invalidFiles.filter((name) => name.endsWith('.js'));
      const jsx = invalidFiles.filter((name) => name.endsWith('.jsx'));
      const jsMessage = js.length && `${js.length} .js`;
      const jsxMessage = jsx.length && `${jsx.length} .jsx`;

      const message = `You have added ${[jsMessage, jsxMessage]
        .filter(Boolean)
        .join(' and ')} files, please convert to ts(x). \n ${invalidFiles.join(
        '\n'
      )}`;

      await octokit.pulls.createReview({
        owner,
        event: 'REQUEST_CHANGES',
        repo,
        pull_number: parseInt(issue_number),
        body: message,
      });
      throw new Error(message);
    }

    const reviews = await octokit.pulls.listReviews({
      owner,
      repo,
      pull_number: parseInt(issue_number),
    });
    const dismiss = reviews.data.filter((review) => {
      return (
        review.state === 'CHANGES_REQUESTED' &&
        review.user?.login === 'github-actions[bot]' &&
        review.body.includes('You have added') &&
        review.body.includes('files, please convert to ts(x).')
      );
    });

    dismiss.map((d) => {
      return octokit.pulls.dismissReview({
        owner,
        repo,
        pull_number: parseInt(issue_number),
        review_id: d.id,
        message: 'js files removed',
      });
    });

    core.setOutput('time', new Date().toTimeString());
  } catch (error) {
    core.setFailed((error as any).message);
  }
}

run();
