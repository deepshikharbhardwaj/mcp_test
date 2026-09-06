-- Run this ONCE in the Supabase SQL Editor before (re-)running 0001_init.sql,
-- only if you already ran an earlier version of that migration. Safe on an
-- empty/test project — drops these tables and everything in them.

drop table if exists exports cascade;
drop table if exists blog_section_variants cascade;
drop table if exists blog_document_variants cascade;
drop table if exists image_placements cascade;
drop table if exists blog_sections cascade;
drop table if exists blog_documents cascade;
drop table if exists images cascade;
drop table if exists events cascade;
drop table if exists transcripts cascade;
drop table if exists recordings cascade;
drop table if exists days cascade;
drop table if exists trips cascade;

drop policy if exists "recordings bucket owned by user" on storage.objects;
drop policy if exists "images bucket owned by user" on storage.objects;
