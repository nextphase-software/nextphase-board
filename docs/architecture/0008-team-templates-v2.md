# 0008 — Team templates contract

CONTRACT VERSION: 0008 team templates v2 (2026-11-16)

Status: Draft for 0010-W3 v1. Replaces [team templates v1](0008-team-templates-v1.md), whose storage,
rights, limits, server checks, wrapper (document v18: stored objects carry no `page`) and panel rules
remain word for word except as below. A hosted board may now hold several pages
([document v19](0001-document-v19.md)).

## Saving with nothing selected

On a board with **two or more pages**, saving with nothing selected saves **the open page's objects**,
not every page's:

| Where | One page (unchanged) | Two or more pages |
| --- | --- | --- |
| Button | `Save board as template` | `Save page as template` |
| Tip on hover and keyboard focus | `Nothing is selected, so all <n> objects on this board are saved` | `Nothing is selected, so all <n> objects on this page are saved` |
| Dialog's source line | `All <n> objects on <board title>` | `All <n> objects on “<page name>” of <board title>` |

`<n>` counts the open page's objects. Saving a selection is unchanged: a selection is always on the open
page. The saved template's objects carry no `page`, as before.

## Inserting

Inserting a team template, or an activity, puts its objects on the **open page** (document v18, unchanged
here). Placement beside existing objects considers only the open page's objects.
