// SPDX-License-Identifier: Apache-2.0
import { ARRANGE_GROUPS, type ArrangeCommand } from "../arrange";

type Props = {
  prefix: string;
  choose: (name: ArrangeCommand) => void;
  arrangementReason: (name: ArrangeCommand) => string;
};

export function ArrangeControls({
  prefix, choose, arrangementReason
}: Props) {
  return ARRANGE_GROUPS.map((group) => <div key={group.label} className="arrange-group"
    role="group" aria-label={group.label}>
    <h3>{group.label}</h3>
    {group.commands.map((name) => {
      const reason = arrangementReason(name);
      const description = prefix + "-" + name.replaceAll(" ", "-");
      return <span key={name}>
        <button disabled={!!reason} title={reason || name}
          aria-describedby={reason ? description : undefined}
          onClick={(e) => { e.currentTarget.focus(); choose(name); }}>{name}</button>
        {reason && <span className="sr-only" id={description}>{reason}</span>}
      </span>;
    })}
  </div>);
}
