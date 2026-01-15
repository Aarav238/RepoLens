import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { shouldIncludeFile } from '../utils/fileFilter';

/**
 * GitHub Repository Fetcher
 * 
 * Fetches all relevant files from a GitHub repository
 */

export interface RepoFile {
  path: string;
  content: string;
}

export interface RepoFetchOptions {
  owner: string;
  repo: string;
  branch?: string;
}

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: string;
  sha: string;
  size?: number;
  url: string;
}

interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

interface GitHubContentResponse {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: string;
  content: string;
  encoding: string;
}

/**
 * Creates an authenticated GitHub API client
 */
function createGitHubClient(): AxiosInstance {
  const token = process.env.GITHUB_TOKEN;
  
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }

  return axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'RepoLens-Backend'
    }
  });
}

/**
 * Fetches the repository tree recursively
 */
async function fetchRepoTree(
  client: AxiosInstance,
  owner: string,
  repo: string,
  branch: string
): Promise<GitHubTreeItem[]> {
  try {
    // First, get the branch SHA
    logger.debug('Fetching branch reference', { owner, repo, branch });
    const branchResponse = await client.get(`/repos/${owner}/${repo}/git/ref/heads/${branch}`);
    const branchSha = branchResponse.data.object.sha;

    // Then, get the tree recursively
    logger.debug('Fetching repository tree', { owner, repo, branch, sha: branchSha });
    const treeResponse = await client.get<GitHubTreeResponse>(
      `/repos/${owner}/${repo}/git/trees/${branchSha}?recursive=1`
    );

    if (treeResponse.data.truncated) {
      logger.warn('Repository tree was truncated - some files may be missing', {
        owner,
        repo,
        branch
      });
    }

    return treeResponse.data.tree;
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error(`Repository or branch not found: ${owner}/${repo}@${branch}`);
    }
    if (error.response?.status === 403) {
      throw new Error('GitHub API rate limit exceeded or access denied. Check your GITHUB_TOKEN.');
    }
    throw new Error(`Failed to fetch repository tree: ${error.message}`);
  }
}

/**
 * Fetches file content from GitHub
 */
async function fetchFileContent(
  client: AxiosInstance,
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<string> {
  try {
    logger.debug('Fetching file content', { owner, repo, path, branch });
    
    const response = await client.get<GitHubContentResponse>(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`
    );

    if (response.data.encoding === 'base64' && response.data.content) {
      // Decode base64 content
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      return content;
    }

    throw new Error(`Unexpected encoding: ${response.data.encoding}`);
  } catch (error: any) {
    if (error.response?.status === 404) {
      logger.warn('File not found', { owner, repo, path, branch });
      throw new Error(`File not found: ${path}`);
    }
    throw new Error(`Failed to fetch file content for ${path}: ${error.message}`);
  }
}

/**
 * Fetches all files from a GitHub repository
 * @param options - Repository options (owner, repo, branch)
 * @returns Array of repository files with their content
 */
export async function fetchRepoFiles(options: RepoFetchOptions): Promise<RepoFile[]> {
  const { owner, repo, branch = 'main' } = options;
  const startTime = Date.now();

  logger.info('Fetching repository files', { owner, repo, branch });

  try {
    const client = createGitHubClient();

    // 1. Fetch repo tree
    const treeItems = await fetchRepoTree(client, owner, repo, branch);
    logger.info('Repository tree fetched', {
      owner,
      repo,
      branch,
      totalItems: treeItems.length
    });

    // 2. Filter files (only include blobs with allowed extensions)
    const fileItems = treeItems.filter(
      (item) => item.type === 'blob' && shouldIncludeFile(item.path)
    );

    logger.info('Files filtered', {
      owner,
      repo,
      branch,
      totalFiles: fileItems.length,
      filteredFrom: treeItems.length
    });

    // 3. Fetch file content in parallel (with rate limiting consideration)
    // GitHub API allows up to 5000 requests/hour for authenticated users
    // We'll fetch in batches to avoid overwhelming the API
    const BATCH_SIZE = 10;
    const repoFiles: RepoFile[] = [];

    for (let i = 0; i < fileItems.length; i += BATCH_SIZE) {
      const batch = fileItems.slice(i, i + BATCH_SIZE);
      logger.debug('Fetching file batch', {
        batch: i / BATCH_SIZE + 1,
        totalBatches: Math.ceil(fileItems.length / BATCH_SIZE),
        batchSize: batch.length
      });

      const batchPromises = batch.map((item) =>
        fetchFileContent(client, owner, repo, item.path, branch)
          .then((content) => ({
            path: item.path,
            content
          }))
          .catch((error) => {
            logger.warn('Failed to fetch file, skipping', {
              path: item.path,
              error: error.message
            });
            return null;
          })
      );

      const batchResults = await Promise.all(batchPromises);
      const validFiles = batchResults.filter((file): file is RepoFile => file !== null);
      repoFiles.push(...validFiles);

      // Small delay between batches to be respectful to GitHub API
      if (i + BATCH_SIZE < fileItems.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const duration = Date.now() - startTime;
    logger.info('Repository files fetched successfully', {
      owner,
      repo,
      branch,
      totalFiles: repoFiles.length,
      duration: `${duration}ms`
    });

    return repoFiles;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Failed to fetch repository files', {
      owner,
      repo,
      branch,
      error: error instanceof Error ? error.message : String(error),
      duration: `${duration}ms`
    });
    throw error;
  }
}
