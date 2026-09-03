import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { FiBold, FiImage, FiItalic, FiLink, FiList, FiMinus, FiMoreHorizontal, FiPlus, FiRotateCcw, FiRotateCw, FiTable, FiTrash2, FiType, FiUnderline } from 'react-icons/fi';

import { uploadBlogImage } from '../../lib/blogService';

type RichTextEditorProps = { value: string; onChange: (html: string) => void; postId: string };

function ToolbarButton({ active, children, label, onClick, dark = false }: { active?: boolean; children: ReactNode; label: string; onClick: () => void; dark?: boolean }) {
  return <button type="button" title={label} aria-label={label} onMouseDown={(event) => { event.preventDefault(); onClick(); }} className={`grid size-9 place-items-center rounded-lg text-sm font-extrabold transition ${dark ? active ? 'text-brand-orange' : 'text-white hover:bg-white/10' : active ? 'bg-[#fff4ec] text-brand-orange' : 'text-brand-softText hover:bg-brand-muted hover:text-brand-charcoal'}`}>{children}</button>;
}

function Divider() { return <span className="mx-1 hidden h-6 w-px bg-brand-border md:block" />; }
function TableSizeGrid({ onSelect }: { onSelect: (rows: number, columns: number) => void }) {
  const [hovered, setHovered] = useState({ rows: 3, columns: 3 });
  return <div className="absolute left-0 top-full z-50 mt-2 w-[218px] rounded-xl border border-brand-border bg-white p-3 shadow-[0_12px_32px_rgba(0,0,0,0.16)]" onMouseLeave={() => setHovered({ rows: 3, columns: 3 })}>
    <p className="mb-2 text-center text-xs font-extrabold text-brand-charcoal">{hovered.columns} ? {hovered.rows} table</p>
    <div className="grid grid-cols-8 gap-1" role="grid" aria-label="Choose table size">{Array.from({ length: 64 }, (_, index) => {
      const row = Math.floor(index / 8) + 1;
      const column = (index % 8) + 1;
      const selected = row <= hovered.rows && column <= hovered.columns;
      return <button key={index} type="button" role="gridcell" aria-label={`${column} columns by ${row} rows`} onMouseEnter={() => setHovered({ rows: row, columns: column })} onMouseDown={(event) => { event.preventDefault(); onSelect(row, column); }} className={`size-5 rounded-[3px] border transition ${selected ? 'border-brand-orange bg-[#fff0e7]' : 'border-[#d9d9d9] bg-white hover:border-brand-orange'}`} />;
    })}</div>
  </div>;
}

function TableAction({ children, label, danger = false, onClick }: { children: ReactNode; label: string; danger?: boolean; onClick: () => void }) {
  return <button type="button" title={label} aria-label={label} onMouseDown={(event) => { event.preventDefault(); onClick(); }} className={`inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-bold transition ${danger ? 'text-red-600 hover:bg-red-50' : 'text-brand-charcoal hover:bg-brand-muted'}`}>{children}</button>;
}


export function RichTextEditor({ value, onChange, postId }: RichTextEditorProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [tablePickerOpen, setTablePickerOpen] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3, 4] } }), Underline, Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }), Image.configure({ HTMLAttributes: { class: 'blog-content-image' } }), Table.configure({ resizable: true, HTMLAttributes: { class: 'blog-content-table', style: 'width: 100%;' } }), TableRow, TableHeader, TableCell, Placeholder.configure({ placeholder: 'Write the article body...' })],
    content: value || '',
    editorProps: { attributes: { class: 'min-h-[600px] border-x border-b border-brand-border bg-white px-7 py-6 text-[17px] leading-[1.7] text-brand-charcoal outline-none' } },
    onUpdate({ editor }) { onChange(editor.getHTML()); },
    onSelectionUpdate({ editor }) {
      if (editor.state.selection.empty) setLinkOpen(false);
    },
  });

  useEffect(() => { if (editor && value !== editor.getHTML()) editor.commands.setContent(value || '', { emitUpdate: false }); }, [editor, value]);
  if (!editor) return null;

  async function handleImage(file: File) {
    setError(''); setUploading(true);
    try { const { url } = await uploadBlogImage(file, 'content', postId); editor?.chain().focus().setImage({ src: url, alt: file.name }).run(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Image upload failed.'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  function openLinkPopover() {
    setLinkUrl((editor.getAttributes('link').href as string | undefined) ?? '');
    setLinkOpen(true);
  }

  function applyLink() {
    const url = linkUrl.trim();
    if (!url) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    setLinkOpen(false);
  }

  function insertBlock(kind: 'paragraph' | 'heading' | 'image' | 'bullet' | 'numbered' | 'quote' | 'divider' | 'table') {
    const chain = editor.chain().focus();
    if (kind === 'paragraph') chain.setParagraph().run();
    if (kind === 'heading') chain.toggleHeading({ level: 2 }).run();
    if (kind === 'bullet') chain.toggleBulletList().run();
    if (kind === 'numbered') chain.toggleOrderedList().run();
    if (kind === 'quote') chain.toggleBlockquote().run();
    if (kind === 'divider') chain.setHorizontalRule().run();
    if (kind === 'table') chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    if (kind === 'image') fileRef.current?.click();
    setInsertOpen(false);
  }

  const inTable = editor.isActive('table');

  return (
    <div>
      <BubbleMenu editor={editor} options={{ placement: 'top', offset: 8, shift: true }} shouldShow={({ editor }) => editor.isFocused && !editor.isActive('table') && !editor.state.selection.empty}>
        <div className="flex items-center gap-1 rounded-[10px] bg-brand-charcoal p-1 text-white shadow-[0_6px_24px_rgba(0,0,0,0.14)]">
          {linkOpen ? <div className="flex items-center gap-1 p-1"><input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') applyLink(); if (event.key === 'Escape') setLinkOpen(false); }} placeholder="https://" className="h-8 w-52 rounded-md border border-white/10 bg-white px-2 text-xs font-semibold text-brand-charcoal outline-none" autoFocus /><button type="button" onMouseDown={(event) => { event.preventDefault(); applyLink(); }} className="h-8 rounded-md bg-brand-orange px-2 text-xs font-bold text-white">Apply</button><button type="button" onMouseDown={(event) => { event.preventDefault(); editor.chain().focus().extendMarkRange('link').unsetLink().run(); setLinkOpen(false); }} className="h-8 rounded-md px-2 text-xs font-bold text-white hover:bg-white/10">Remove</button></div> : <><ToolbarButton dark label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><FiBold /></ToolbarButton><ToolbarButton dark label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><FiItalic /></ToolbarButton><ToolbarButton dark label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><FiUnderline /></ToolbarButton><ToolbarButton dark label="Insert Link" active={editor.isActive('link')} onClick={openLinkPopover}><FiLink /></ToolbarButton></>}
        </div>
      </BubbleMenu>
      <BubbleMenu editor={editor} options={{ placement: 'top', offset: 10, shift: true }} shouldShow={({ editor }) => editor.isFocused && editor.isActive('table')}>
        <div className="flex items-center gap-0.5 rounded-lg border border-brand-border bg-white p-1 shadow-[0_8px_24px_rgba(0,0,0,0.14)]">
          <TableAction label="Add row below" onClick={() => editor.chain().focus().addRowAfter().run()}><FiPlus /><span>Row</span></TableAction>
          <TableAction label="Add column right" onClick={() => editor.chain().focus().addColumnAfter().run()}><FiPlus /><span>Column</span></TableAction>
          <span className="mx-1 h-5 w-px bg-brand-border" />
          <TableAction label="Delete selected row" danger onClick={() => editor.chain().focus().deleteRow().run()}><FiTrash2 /><span>Row</span></TableAction>
          <TableAction label="Delete selected column" danger onClick={() => editor.chain().focus().deleteColumn().run()}><FiTrash2 /><span>Column</span></TableAction>
          <TableAction label="Remove table" danger onClick={() => editor.chain().focus().deleteTable().run()}><FiTrash2 /></TableAction>
        </div>
      </BubbleMenu>

      <FloatingMenu editor={editor} options={{ placement: 'left-start', offset: 8, shift: true }} shouldShow={({ editor }) => editor.isFocused && editor.isActive('paragraph') && editor.state.selection.empty && editor.state.doc.textBetween(editor.state.selection.$from.before(), editor.state.selection.$from.after()).trim().length === 0}>
        <div className="relative"><button type="button" title="Add content" aria-label="Add content" onMouseDown={(event) => { event.preventDefault(); setInsertOpen((open) => !open); }} className="grid size-8 place-items-center rounded-full border border-brand-border bg-white text-lg font-bold text-brand-softText shadow-sm hover:border-brand-orange hover:text-brand-orange">+</button>{insertOpen ? <div className="absolute left-9 top-0 z-40 w-48 rounded-lg border border-brand-border bg-white p-1 shadow-lg"><p className="px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-brand-softText">Add Content</p><button type="button" onMouseDown={(event) => { event.preventDefault(); insertBlock('paragraph'); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-brand-muted"><FiType />Paragraph</button><button type="button" onMouseDown={(event) => { event.preventDefault(); insertBlock('heading'); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-brand-muted"><FiType />Heading</button><button type="button" onMouseDown={(event) => { event.preventDefault(); insertBlock('image'); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-brand-muted"><FiImage />Image</button><button type="button" onMouseDown={(event) => { event.preventDefault(); insertBlock('bullet'); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-brand-muted"><FiList />Bullet List</button><button type="button" onMouseDown={(event) => { event.preventDefault(); insertBlock('numbered'); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-brand-muted">1. Numbered List</button><button type="button" onMouseDown={(event) => { event.preventDefault(); insertBlock('quote'); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-brand-muted">“ Quote</button><button type="button" onMouseDown={(event) => { event.preventDefault(); insertBlock('divider'); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-brand-muted"><FiMinus />Divider</button><button type="button" onMouseDown={(event) => { event.preventDefault(); insertBlock('table'); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-brand-muted"><FiTable />Table</button></div> : null}</div>
      </FloatingMenu>

      <div className="sticky top-16 z-30 flex flex-wrap items-center gap-1 overflow-visible border border-brand-border bg-white px-3 py-2">
        <select aria-label="Text style" value={editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : editor.isActive('heading', { level: 4 }) ? 'h4' : 'paragraph'} onChange={(event) => { const next = event.target.value; if (next === 'paragraph') editor.chain().focus().setParagraph().run(); if (next === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run(); if (next === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run(); if (next === 'h4') editor.chain().focus().toggleHeading({ level: 4 }).run(); }} className="mr-1 h-9 shrink-0 rounded-lg border border-brand-border bg-white px-3 text-xs font-bold text-brand-charcoal outline-none focus:border-brand-orange"><option value="paragraph">Paragraph</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="h4">Heading 4</option></select>
        <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><FiBold /></ToolbarButton><ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><FiItalic /></ToolbarButton><ToolbarButton label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><FiUnderline /></ToolbarButton><Divider /><ToolbarButton label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><FiList /></ToolbarButton><ToolbarButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</ToolbarButton><Divider /><ToolbarButton label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>“</ToolbarButton><ToolbarButton label="Insert Link" active={editor.isActive('link')} onClick={openLinkPopover}><FiLink /></ToolbarButton><Divider /><ToolbarButton label={uploading ? 'Uploading image' : 'Insert image'} onClick={() => fileRef.current?.click()}>{uploading ? '...' : <FiImage />}</ToolbarButton><div className="relative shrink-0"><ToolbarButton label="Insert table" active={tablePickerOpen} onClick={() => setTablePickerOpen((open) => !open)}><FiTable /></ToolbarButton>{tablePickerOpen ? <TableSizeGrid onSelect={(rows, columns) => { editor.chain().focus().insertTable({ rows, cols: columns, withHeaderRow: true }).run(); setTablePickerOpen(false); }} /> : null}</div><Divider /><ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}><FiRotateCcw /></ToolbarButton><ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}><FiRotateCw /></ToolbarButton>
        <div className="relative"><ToolbarButton label="More editor options" onClick={() => setMoreOpen((open) => !open)}><FiMoreHorizontal /></ToolbarButton>{moreOpen ? <div className="absolute right-0 z-40 mt-2 w-52 rounded-lg border border-brand-border bg-white p-1 shadow-lg"><button type="button" onMouseDown={(event) => { event.preventDefault(); editor.chain().focus().setHorizontalRule().run(); setMoreOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-brand-muted"><FiMinus />Divider</button>{inTable ? <><button type="button" onMouseDown={(event) => { event.preventDefault(); editor.chain().focus().addRowBefore().run(); setMoreOpen(false); }} className="block w-full rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-brand-muted">Add row above</button><button type="button" onMouseDown={(event) => { event.preventDefault(); editor.chain().focus().addRowAfter().run(); setMoreOpen(false); }} className="block w-full rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-brand-muted">Add row below</button><button type="button" onMouseDown={(event) => { event.preventDefault(); editor.chain().focus().addColumnBefore().run(); setMoreOpen(false); }} className="block w-full rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-brand-muted">Add column left</button><button type="button" onMouseDown={(event) => { event.preventDefault(); editor.chain().focus().addColumnAfter().run(); setMoreOpen(false); }} className="block w-full rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-brand-muted">Add column right</button><button type="button" onMouseDown={(event) => { event.preventDefault(); editor.chain().focus().deleteRow().run(); setMoreOpen(false); }} className="block w-full rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-red-50">Delete row</button><button type="button" onMouseDown={(event) => { event.preventDefault(); editor.chain().focus().deleteColumn().run(); setMoreOpen(false); }} className="block w-full rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-red-50">Delete column</button><button type="button" onMouseDown={(event) => { event.preventDefault(); editor.chain().focus().deleteTable().run(); setMoreOpen(false); }} className="block w-full rounded-md px-3 py-2 text-left text-sm font-bold text-red-600 hover:bg-red-50">Delete table</button></> : null}</div> : null}</div>
      </div>
      <EditorContent editor={editor} />
      <input ref={fileRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp,image/avif" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImage(file); }} />
      {error ? <p className="mt-2 text-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}


