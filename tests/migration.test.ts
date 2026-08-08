import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const sql=fs.readFileSync(new URL('../supabase/migrations/20260808000100_platform_phase5_complete.sql',import.meta.url),'utf8')
test('migration defines atomic release activation and one-active invariant',()=>{assert.match(sql,/create or replace function public\.activate_release/i);assert.match(sql,/one_active_site_release/i);assert.match(sql,/where status = 'active'/i)})
test('migration protects published layouts and content',()=>{assert.match(sql,/Published layout versions are immutable/);assert.match(sql,/Pages in published layout versions are immutable/);assert.match(sql,/Published content revisions are immutable/)})
test('Studio document persistence is atomic and rejects cross-version page ownership',()=>{assert.match(sql,/create or replace function public\.save_layout_document/i);assert.match(sql,/Page % belongs to another layout version/i);assert.match(sql,/where id = target_version_id and layout_id = target_layout_id\s+for update/i)})
test('page immutability checks both old and new layout-version owners',()=>{assert.match(sql,/old_version_status/i);assert.match(sql,/new_version_status/i);assert.match(sql,/tg_op <> 'INSERT'/i);assert.match(sql,/tg_op <> 'DELETE'/i)})
test('layout publication uses a draft-only database transition',()=>{assert.match(sql,/create or replace function public\.publish_layout_version/i);assert.match(sql,/where id = target_version_id and status = 'draft'/i)})
test('normal profile updates cannot self-promote role',()=>{assert.match(sql,/profiles_admin_update/);assert.match(sql,/role = 'admin'/)})

test('release snapshots include media references',()=>{assert.match(sql,/media_snapshot jsonb/i)})
test('draft deletes return OLD instead of silently cancelling',()=>{assert.match(sql,/if tg_op = 'DELETE' then return old; end if;/i)})

test('settings revisions and activated release snapshots are immutable',()=>{assert.match(sql,/Published settings revisions are immutable/);assert.match(sql,/Activated release snapshots are immutable/)})
