// SPDX-License-Identifier: Apache-2.0
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../api';
import { authorColour, changedText, normalizeText, replaceRange, triggerAt, type Candidate, type Mention, type MentionDraft } from './rules';
import { createPortal } from 'react-dom';
type Selection = { start: number; end: number };
export function MentionText({ text, mentions = [] }: MentionDraft) {
  const points = [...text], nodes = []; let start = 0;
  for (const m of mentions) { nodes.push(points.slice(start,m.start).join(''), <span key={m.start} className="w2-mention">{points.slice(m.start,m.end).join('')}</span>); start=m.end; }
  nodes.push(points.slice(start).join('')); return <>{nodes}</>;
}
export function MentionEditor({ boardId, value, change, readOnly, label, edit, post, enabled, autoFocus }: {
  autoFocus: boolean; enabled: boolean; boardId: string; value: MentionDraft; change: (draft: MentionDraft) => void; readOnly: boolean; label: string; edit: boolean; post: () => void;
}) {
  const field = useRef<HTMLDivElement>(null), picker = useRef<HTMLDivElement>(null), composing = useRef(false);
  const caret = useRef<Selection | null>(null), history = useRef<MentionDraft[]>([]), future = useRef<MentionDraft[]>([]);
  const [selection,setSelection] = useState<Selection>({start:[...value.text].length,end:[...value.text].length});
  const [closed,setClosed] = useState(''), [page,setPage] = useState(0), [selected,setSelected] = useState(0), [retry,setRetry] = useState(0);
  const [roster,setRoster] = useState<{state:'loading'|'failed'|'ready';candidates:Candidate[];more:boolean}>({state:'loading',candidates:[],more:false});
  const [position,setPosition] = useState({left:12,top:72});
  const [focused,setFocused] = useState(false);
  const trigger = focused && enabled && !readOnly && !composing.current && selection.start===selection.end ? triggerAt(value,selection.end) : null;
  const triggerKey = trigger ? `${trigger.start}:${trigger.query}` : '';
  const open = !!trigger && triggerKey!==closed;
  function range(): Selection {
    const node=field.current!, s=window.getSelection();
    if (!s?.rangeCount || !node.contains(s.anchorNode) || !node.contains(s.focusNode)) return selection;
    const r=s.getRangeAt(0), before=r.cloneRange(); before.selectNodeContents(node); before.setEnd(r.startContainer,r.startOffset);
    const start=[...before.toString()].length; return {start,end:start+[...r.toString()].length};
  }
  function place(offset: number) {
    const node=field.current!; let left=offset; const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT); let text:Node|null;
    const r=document.createRange(); while((text=walker.nextNode())) { const size=[...text.textContent!].length; if(left<=size){const chip=text.parentElement?.closest('.w2-mention');if(chip&&left===size)r.setStartAfter(chip);else if(chip&&left===0)r.setStartBefore(chip);else r.setStart(text,[...text.textContent!].slice(0,left).join('').length);break;} left-=size; }
    if(!text){r.selectNodeContents(node);r.collapse(false);} else r.collapse(true);
    window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(r);
  }
  function update(next:MentionDraft, at:number, record=true) {
    if(record){history.current.push(structuredClone(value)); if(history.current.length>100)history.current.shift();future.current=[];}
    caret.current={start:at,end:at};setSelection(caret.current);change(next);
  }
  useLayoutEffect(()=>{
    const node=field.current!; if(composing.current)return;
    const focused=document.activeElement===node, old=caret.current??(focused?range():null);
    node.replaceChildren();let start=0;const points=[...value.text];
    for(const m of value.mentions??[]){node.append(document.createTextNode(points.slice(start,m.start).join('')));const span=document.createElement('span');span.className='w2-mention';span.contentEditable='false';span.dataset.person=m.person;span.textContent=points.slice(m.start,m.end).join('');node.append(span);start=m.end;}
    node.append(document.createTextNode(points.slice(start).join('')));
    if(focused&&old)place(old.end);caret.current=null;
  },[value.text,JSON.stringify(value.mentions)]);
  useEffect(()=>{if(autoFocus){field.current?.focus();place([...value.text].length);}},[]);
  useEffect(()=>{setPage(0);setSelected(0);},[triggerKey]);
  useEffect(()=>{
    if(!open||!trigger)return;let alive=true;setRoster({state:'loading',candidates:[],more:false});
    void api<{candidates:Candidate[];more:boolean}>(`/boards/${boardId}/participants?q=${encodeURIComponent(trigger.query)}&page=${page}`)
      .then(r=>{if(alive){setRoster({state:'ready',...r});setSelected(0);}}).catch(()=>{if(alive)setRoster({state:'failed',candidates:[],more:false});});
    return()=>{alive=false;};
  },[open,triggerKey,page,retry,boardId]);
  useLayoutEffect(()=>{
    if(!open||!field.current||!picker.current)return;
    const rect=field.current.getBoundingClientRect(), height=picker.current.getBoundingClientRect().height, width=Math.min(300,innerWidth-24);
    setPosition({left:Math.max(12,Math.min(rect.left,innerWidth-width-12)),top:Math.max(72,rect.bottom+6+height>innerHeight-80?rect.top-height-6:rect.bottom+6)});
  },[open,roster,page]);
  function insert(candidate:Candidate){if(!trigger)return;const text='@'+candidate.label;const end=trigger.start+[...text].length;const m:Mention={start:trigger.start,end,person:candidate.person,label:candidate.label};update(replaceRange(value,trigger.start,trigger.end,text,m),end);setClosed(`${trigger.start}:${candidate.label}`);field.current?.focus();}
  function insertText(input:string){const text=normalizeText(input),s=range();update(replaceRange(value,s.start,s.end,text),s.start+[...text].length);}
  return <><div ref={field} className="w2-editor" role="textbox" tabIndex={0} aria-label={label} aria-multiline="true"
    aria-readonly={readOnly} aria-expanded={open} aria-controls={open?'mention-options':undefined} aria-activedescendant={open&&roster.candidates.length?`mention-option-${selected}`:undefined}
    contentEditable={!readOnly} suppressContentEditableWarning data-placeholder={label==='Unposted edit'?'':label}
    onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
    onSelect={()=>setSelection(range())} onClick={()=>setSelection(range())} onKeyUp={()=>setSelection(range())}
    onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;const node=field.current!,text=normalizeText(node.innerText);const s=range();update(changedText(value,text),text!==node.textContent?[...text].length:s.end);}}
    onInput={()=>{if(!composing.current){const node=field.current!,text=normalizeText(node.innerText);const s=range();update(changedText(value,text),text!==node.textContent?[...text].length:s.end);setClosed('');}}}
    onCopy={e=>{e.preventDefault();e.clipboardData.setData('text/plain',window.getSelection()?.toString()??'');}}
    onCut={e=>{e.preventDefault();e.clipboardData.setData('text/plain',window.getSelection()?.toString()??'');if(!readOnly)insertText('');}}
    onPaste={e=>{e.preventDefault();if(!readOnly)insertText(e.clipboardData.getData('text/plain').replace(/\r\n?/g,'\n'));}}
    onKeyDown={e=>{
      if(e.nativeEvent.isComposing||composing.current)return;
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){
        e.preventDefault();e.stopPropagation();if(readOnly)return;
        const from=e.shiftKey?future.current:history.current,to=e.shiftKey?history.current:future.current,next=from.pop();if(next){to.push(structuredClone(value));update(next,[...next.text].length,false);}return;
      }
      if(!readOnly && !e.ctrlKey && !e.metaKey && !e.altKey && [...e.key].length===1){
        const s=range();e.preventDefault();setClosed('');update(replaceRange(value,s.start,s.end,e.key),s.start+1);return;
      }
      if(open){
        if(e.key==='PageDown'&&roster.more){e.preventDefault();setPage(n=>n+1);return;}
        if(e.key==='PageUp'&&page>0){e.preventDefault();setPage(n=>n-1);return;}
        if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();e.stopPropagation();setSelected(n=>roster.candidates.length?(n+(e.key==='ArrowDown'?1:roster.candidates.length-1))%roster.candidates.length:0);return;}
        if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setClosed(triggerKey);return;}
        if(e.key==='Enter'||e.key==='Tab'){
          if(roster.state==='ready'&&roster.candidates.length){e.preventDefault();e.stopPropagation();insert(roster.candidates[selected]);}
          else if(e.key==='Enter'){e.preventDefault();e.stopPropagation();}else setClosed(triggerKey);
          return;
        }
      }
      if(e.key==='Enter'){e.preventDefault();if(!readOnly){if(e.shiftKey)insertText('\n');else post();}return;}
      if(e.key==='Backspace'&&!readOnly){const s=range(),m=value.mentions?.find(m=>s.start===s.end&&m.end===s.start);if(m){e.preventDefault();update(replaceRange(value,m.start,m.end,''),m.start);}}
    }}/>
    {open&&createPortal(<div ref={picker} className="w2-picker" style={position} onPointerDown={e=>e.preventDefault()} onKeyDown={e=>e.stopPropagation()}>
      <div className="w2-picker-label">Mention a participant{page>0?' · More results':''}</div>
      {roster.state==='ready'&&roster.candidates.length>0?<div className="w2-options" id="mention-options" role="listbox" aria-label="Participants">
        {roster.candidates.map((c,i)=><div key={c.person} id={`mention-option-${i}`} className="w2-option" role="option" aria-selected={i===selected} onMouseEnter={()=>setSelected(i)} onClick={()=>insert(c)}>
          <span className="comment-avatar" style={{background:authorColour(c.person)}}>{c.label[0]?.toUpperCase()}</span><span>{c.label}</span>{c.suffix&&<small>{c.suffix}</small>}
        </div>)}</div>:<div className={'w2-picker-state'+(roster.state==='failed'?' error':'')}>{roster.state==='loading'?'Loading participants…':roster.state==='failed'?<>Couldn’t load participants. Try again.<br/><button onClick={()=>setRetry(n=>n+1)}>Retry</button></>:'No matching participants.'}</div>}
      {roster.state==='ready'&&roster.more&&<div className="w2-picker-foot"><button onClick={()=>setPage(n=>n+1)}>More</button></div>}
      <div className="w2-picker-keys">{roster.state==='ready'&&roster.candidates.length?'↑ ↓ to choose · Tab or Enter to insert · Esc to close':'Esc keeps your text'}</div>
    </div>,document.body)}
  </>;
}
