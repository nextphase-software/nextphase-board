// SPDX-License-Identifier: Apache-2.0
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BoardVoting } from './voting';
import type { ItemV12 } from 'nextphase-board-rules/document.ts';
import { eligibleTargets, eligibleVote, ownBallot, rankedResults, remainingWords, targetMatches, validQuestion, validBudget, voteLabel } from './voting-rules';
const identity=(n:HTMLElement)=>n.getAttribute('data-vote')??n.getAttribute('aria-label')??n.id;
export function VotingCard({voting,objects,preview}:{voting:BoardVoting;objects:ItemV12[];preview:boolean}) {
  const [,redraw]=useState(0),root=useRef<HTMLDivElement>(null),heading=useRef<HTMLHeadingElement>(null);
  const focused=useRef<{node:HTMLElement;key:string|null}|null>(null),previous=useRef('');
  useEffect(()=>voting.subscribe(()=>redraw(n=>n+1)),[voting]);
  const p=voting.projection,s=p?.session,own=ownBallot(p),manage=voting.canManage;
  const options=s?eligibleTargets(s.targets,objects):[],selected=options.find(o=>o.id===voting.selected)??options[0];
  const voted=!!own&&!!selected&&own.targets.some(t=>targetMatches(t,selected));
  const phase=voting.confirmation?.action??(voting.setup&&s?.status==='idle'?'setup':s?.status??'connecting');
  useLayoutEffect(()=>{
    const node=root.current;if(!node)return;
    if(phase!==previous.current&&(phase==='setup'||phase==='reveal'||phase==='clear'))node.querySelector<HTMLElement>(phase==='setup'?'textarea':'[data-vote="cancel"]')?.focus();
    else if(focused.current&&(node.contains(document.activeElement)||document.activeElement===document.body)&&
      (!focused.current.node.isConnected||(focused.current.node as HTMLButtonElement).disabled||identity(focused.current.node)!==focused.current.key))heading.current?.focus();
    previous.current=phase;
  });
  const cancel=()=>{const action=voting.confirmation?.action;voting.cancelConfirm();requestAnimationFrame(()=>root.current?.querySelector<HTMLElement>(`[data-vote="${action}-opener"]`)?.focus());};
  const confirmation=voting.confirmation;
  return <div className="vote-card" ref={root} onFocusCapture={e=>{const node=e.target as HTMLElement;focused.current={node,key:identity(node)};}} onBlurCapture={e=>{if(e.relatedTarget&&!e.currentTarget.contains(e.relatedTarget as Node))focused.current=null;}}
    onKeyDown={e=>{if(e.key==='Escape'&&confirmation){e.preventDefault();e.stopPropagation();cancel();}}}>
    <h3 ref={heading} tabIndex={-1}>{!confirmation&&s?.status==='revealed'?'Results':'Voting'}</h3>
    {confirmation?<div className="vote-confirm"><h3>{confirmation.action==='reveal'?'End voting for everyone?':'Clear voting results?'}</h3>
      <p>{confirmation.action==='reveal'?'This ends voting and reveals the results to everyone with access to this board.':'This removes the latest voting results for everyone.'}</p>
      <div className="vote-buttons"><button data-vote="cancel" onClick={cancel}>Cancel</button><button data-vote="confirm" className="primary" disabled={!voting.ready||!manage} onClick={()=>voting.confirmCommand()}>{confirmation.action==='reveal'?'End and reveal':'Clear results'}</button></div></div>:<>
      {s&&s.status!=='idle'&&<p>{s.prompt}</p>}
      {voting.status&&<p className="vote-status">{voting.status}</p>}
      {voting.uncertain&&p&&<p className="vote-status">{voting.health==='checking'?'Last confirmed':'Last confirmed · uncertain'}</p>}
      {s?.status==='idle'&&(manage?voting.setup?<>
        <label className="vote-label">Question<textarea disabled={preview||!voting.ready} value={voting.question} onChange={e=>voting.setDraft(e.target.value)} /></label>
        <span className="vote-counter">{[...voting.question].length} / 240</span>
        <label className="vote-label">Votes per person<span className="vote-stepper"><button aria-label="Decrease votes per person" disabled={preview||!voting.ready||voting.budget<=1} onClick={()=>voting.setDraft(voting.question,voting.budget-1)}>−</button>
          <output>{voting.budget}</output><button aria-label="Increase votes per person" disabled={preview||!voting.ready||voting.budget>=20} onClick={()=>voting.setDraft(voting.question,voting.budget+1)}>+</button></span></label>
        <p className="vote-status">All eligible objects on this board</p>
        <button data-vote="start" className="primary" disabled={preview||!voting.ready||!validQuestion(voting.question)||!validBudget(voting.budget)||!objects.some(eligibleVote)} onClick={()=>voting.start()}>Start voting</button>
        <button data-vote="cancel-setup" onClick={()=>voting.cancelSetup()}>Cancel</button>
      </>:<button data-vote="new" className="primary" disabled={preview||!voting.ready} onClick={()=>voting.expand()}>New vote</button>:<p className="vote-status">No voting session.</p>)}
      {s?.status==='running'&&(!manage?<p className="vote-status">Voting in progress. Only owners and editors can vote.</p>:<>
        {own?<><p className="vote-status">{remainingWords(p!)}</p>
          <button data-vote="mode" disabled={!voting.canInput} onClick={()=>voting.toggleMode()}>{voting.mode?'Done voting':'Enter voting'}</button>
          <label className="vote-label">Eligible object<select value={selected?.id??''} disabled={!voting.canInput||!options.length} onChange={e=>voting.choose(e.target.value)}>{options.map(o=><option key={o.id} value={o.id}>{voteLabel(o)}</option>)}</select></label>
          {voted&&<p className="vote-status">Your vote</p>}
          <div className="vote-buttons"><button data-vote="vote" className="primary" disabled={!voting.canInput||!selected||voted||!own.remaining} onClick={()=>voting.toggleTarget(selected,false)}>Vote</button>
            <button data-vote="unvote" disabled={!voting.canInput||!voted} onClick={()=>voting.toggleTarget(selected,true)}>Remove vote</button></div>
        </>:p?.own&&'limited'in p.own?<p className="vote-status">This voting round has reached its participant limit.</p>:null}
        <button data-vote="reveal-opener" disabled={!voting.ready} onClick={()=>voting.confirm('reveal')}>End and reveal</button>
        {preview&&<p className="vote-status">Back to current board to vote.</p>}
      </>)}
      {s?.status==='revealed'&&<><p className="vote-status">Voting ended. Results revealed.</p><div className="vote-results">{rankedResults(p!,objects).map(({target,count,object})=><div className="vote-result" key={target[0]}>
        {object?<button data-vote={'result-'+object.id} disabled={preview} onClick={()=>voting.onNavigate?.(object.id)}>{voteLabel(object)}</button>:<span className="result-label missing">Removed object</span>}<span className="vote-count">{count}</span></div>)}</div>
        {manage&&<button data-vote="clear-opener" disabled={!voting.ready} onClick={()=>voting.confirm('clear')}>Clear results</button>}</>}
      {voting.error&&<p className="vote-status">{voting.error}</p>}
    </>}
  </div>;
}
