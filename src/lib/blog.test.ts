import { describe, expect, it } from 'vitest';
import { BLOG_POSTS, sortPosts } from './blog';

const posts = [
  { slug: 'old', datePublished: '2024-03-12', dateModified: '2026-10-08' },
  { slug: 'new', datePublished: '2026-10-08', dateModified: '2026-10-08' },
  { slug: 'mid', datePublished: '2025-06-17', dateModified: '2025-07-01' },
];

describe('sortPosts', () => {
  it('lists the most recently added first', () => {
    expect(sortPosts(posts, 'added').map((p) => p.slug)).toEqual(['new', 'mid', 'old']);
  });

  it('lists the most recently updated first, ties by added date', () => {
    expect(sortPosts(posts, 'updated').map((p) => p.slug)).toEqual(['new', 'old', 'mid']);
  });

  it('leaves the source list alone', () => {
    sortPosts(posts, 'added');
    expect(posts.map((p) => p.slug)).toEqual(['old', 'new', 'mid']);
  });
});

describe('BLOG_POSTS', () => {
  it('never updates a post before it was added', () => {
    for (const post of BLOG_POSTS) {
      expect(post.dateModified >= post.datePublished, post.slug).toBe(true);
    }
  });

  it('gives every post a raster social card', () => {
    for (const post of BLOG_POSTS) {
      expect(post.socialImage, post.slug).toMatch(/^\/og\/.+\.jpg$/);
    }
  });
});
