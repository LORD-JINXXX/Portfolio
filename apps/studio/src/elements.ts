import type { EditorTool } from '@platform/builder-core'

export const ELEMENTS: { tool: EditorTool; label: string; icon: string }[] = [
  {tool:'section',label:'Section',icon:'§'},{tool:'container',label:'Container',icon:'□'},{tool:'div',label:'Div',icon:'▪'},
  {tool:'header',label:'Header',icon:'H'},{tool:'main',label:'Main',icon:'M'},{tool:'aside',label:'Aside',icon:'A'},
  {tool:'footer',label:'Footer',icon:'F'},{tool:'article',label:'Article',icon:'⒜'},{tool:'nav',label:'Nav',icon:'☰'},
  {tool:'h1',label:'H1',icon:'H1'},{tool:'h2',label:'H2',icon:'H2'},{tool:'h3',label:'H3',icon:'H3'},
  {tool:'h4',label:'H4',icon:'H4'},{tool:'h5',label:'H5',icon:'H5'},{tool:'h6',label:'H6',icon:'H6'},
  {tool:'p',label:'Paragraph',icon:'¶'},{tool:'span',label:'Span',icon:'S'},{tool:'a',label:'Link',icon:'↗'},
  {tool:'button',label:'Button',icon:'▣'},{tool:'ul',label:'UL',icon:'•'},{tool:'ol',label:'OL',icon:'1.'},{tool:'li',label:'LI',icon:'≡'},
  {tool:'img',label:'Image',icon:'▧'},{tool:'video',label:'Video',icon:'▶'},{tool:'audio',label:'Audio',icon:'♪'},{tool:'iframe',label:'iFrame',icon:'⌗'},
  {tool:'form',label:'Form',icon:'✎'},{tool:'input',label:'Input',icon:'▭'},{tool:'textarea',label:'Textarea',icon:'▯'},{tool:'label',label:'Label',icon:'L'},{tool:'select',label:'Select',icon:'⌄'},
  {tool:'collection',label:'Collection',icon:'▦'},{tool:'card',label:'Card',icon:'▤'},{tool:'details',label:'Details',icon:'▸'},{tool:'summary',label:'Summary',icon:'▾'},
  {tool:'blockquote',label:'Quote',icon:'❞'},{tool:'pre',label:'Pre',icon:'⌨'},{tool:'code',label:'Code',icon:'<>'},{tool:'mark',label:'Mark',icon:'▰'},
  {tool:'hr',label:'Divider',icon:'—'},{tool:'br',label:'Break',icon:'↵'},{tool:'figure',label:'Figure',icon:'◫'},{tool:'figcaption',label:'Caption',icon:'C'},
]

export const VIEWPORTS = {
  desktop: { label:'Desktop', width: 1440 },
  tablet: { label:'Tablet', width: 768 },
  mobile: { label:'Mobile', width: 375 },
} as const
