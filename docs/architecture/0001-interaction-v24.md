# 0001 — Interaction and browser contract

Contract version: 24 (for 0012-W1 brief v1, 2026-10-28). Status: Draft. When accepted it
replaces [interaction v23](0001-interaction-v23.md) for later work. Uses
[document v10](0001-document-v10.md), [storage v3](0001-storage-v3.md),
[board file v2](0006-board-file-v2.md) and
[the activity catalogue contract](0008-activity-catalogue-v1.md).

Every rule in v23 (and, through it, v22 back to v4 and the 0001-W3 presentation) still applies
except where this version replaces or adds to it. This version adds **images**: pictures from this
computer are added to the board by an **Image** button, by pasting and by dropping files, and are
then selected, moved, resized, described, copied and deleted like other ideas. Pictures never
leave the page: they are read from the file or clipboard data the browser hands the page, kept in
the browser (storage v3) and in board files (board file v2), and drawn from memory. An image is an
**idea** everywhere v23 says idea, except where this version says otherwise; it is never a
connector end and has no text. It replaces:
- v14's rule that a Cmd/Ctrl+V key press on the canvas always has its default action prevented
  and that Paste never reads the system clipboard: the platform's paste key now reaches the
  browser's `paste` event, which adds image files it carries (see **Paste**);
- v18's rule that every idea's width keeps the 80-unit resize floor, and v11's rule that a corner
  drag keeps proportions only with Shift: a selection holding an image always resizes
  proportionally, and an image's floor is 1 unit (see **Resizing**);
- v20's message "Could not save a copy to file: the board is larger than 4 MB.": the reasons are
  board file v2's (see **Board files**).

## Terms

**Image**, **picture**, **hash** and **pixel size** are document v10's; **available**, **the
board's pictures** and **the board's picture bytes** are storage v3's. To **import** files is to
turn them into images by the steps in **Importing**. A picture's **original size** is the pixel
size of its first frame as the browser decodes the file, before any scaling down. The **platform's
paste key** is Cmd+V when `navigator.platform` contains `Mac`, `iPhone`, `iPad` or `iPod`, and
Ctrl+V otherwise.

**Importing is unavailable** while the tab is read-only, a gesture is in progress, text is being
composed, an editor draft is invalid, or an import is already running; then the Image button is
`disabled` and every other way in does nothing.

## The Image button

The bottom toolbar gains an **Image** button directly after the Templates button (v21). It is not a
tool: it never changes the armed tool except as **Importing** says. Its accessible name is "Image",
its tooltip "Image ⇧⌘K" when the platform's paste key is Cmd+V and "Image Ctrl+Shift+K"
otherwise, and it shows the image icon (a rounded rectangle holding a small circle and a mountain
line). It is unavailable (`disabled`) while importing is unavailable. Below 480 CSS pixels wide,
when the toolbar's buttons no longer fit, the bottom toolbar is at most its container's width minus
24 CSS pixels and scrolls sideways inside itself, staying one row; at wider sizes it is unchanged.

Activating it opens the browser's file picker for **several files**, accepting
`image/png,image/jpeg,image/gif,image/webp`. The picker's `input type="file"` (accessible name
"Choose images") is added to the page only while the picker is opening and is removed when files
are chosen or the picker is cancelled, so the page holds no extra file input otherwise. Choosing
files imports them, in the order the browser lists them, centred on the **view centre** (v4's
`centerX`, `centerY`). Cancelling changes nothing.

**Keys.** Cmd+Shift+K or Ctrl+Shift+K (either modifier, on every platform, without Alt), pressed
anywhere in the page except in a text field (an `input`, a `textarea` or editable text) and while
not composing, does what activating the Image button does; its default action is prevented. It
does nothing while importing is unavailable.

## Paste

**On the canvas.** v14's Cut, Copy and object Paste keys stay as they are, with one change: a
**trusted** key press of the **platform's paste key** (without Alt or Shift) whose target is the
scene runs no command and keeps its default action, so the browser fires a `paste` event at the
scene. Every other Cmd+V or Ctrl+V reaching the scene (the other platform's modifier, or a key
event a script created, which has no default action) runs object Paste on the key press exactly
as v14 says, its default prevented when the event is trusted.

A `paste` event whose target is the scene, while not composing and not already handled (its
default not prevented), has its default prevented and then:
- when its `clipboardData.files` is empty, runs object Paste (v14);
- otherwise, when any of those files has a picture signature (storage v3; its first 16 bytes are
  read) or a `type` starting `image/`, imports all of them, centred on the view centre;
- otherwise runs object Paste.

Only the files the event carries are read: never the asynchronous Clipboard API, never HTML, text
or addresses on the clipboard, and no permission is asked. A clipboard holding an image only as
HTML or an address therefore takes object Paste. Paste events anywhere else (text fields, the
Description field, Objects) keep their native behaviour.

## Dropping files

A `dragover` on the scene has its default prevented, so the scene accepts a drop; nothing is drawn
while files are dragged over it. A `drop` on the scene has its default prevented and imports the
files it carries, centred on the **drop point**: the board point under the pointer, `centerX +
(clientX − left − width ÷ 2) ÷ zoom` and `centerY + (clientY − top − height ÷ 2) ÷ zoom` with the
scene's bounding rectangle and v4's view. A drop carrying no file changes nothing. Only files are
read: a link or text dragged from another page is not imported.

## Importing

Files are imported one import at a time. While an import runs, gestures are unavailable (as during
any busy operation) and every way in does nothing. An import first ends any text session and
commits an open Description draft (as leaving the field does), then takes each file in order:

1. A file larger than 20,971,520 bytes (20 MiB) is refused: "file is larger than 20 MiB".
2. Its bytes are read. Without a picture signature it is refused: "not a supported image (PNG,
   JPEG, GIF or WebP)". The file's name and declared type are never used to decide.
3. It is decoded with `createImageBitmap` from a `Blob` of its bytes with its signature's type.
   If that fails, or the first frame has no pixels, it is refused with the same reason. A GIF or
   WebP with several frames gives its first frame.
4. Its **landing size** comes from its original size `w` × `h`: with `s = min(1, 480 ÷ h)`, the
   landing width is `max(1, w × s)` and the landing height `max(1, h × s)`, computed in
   double-precision floating point (800 × 600 gives 640 × 480; 300 × 200 stays 300 × 200;
   6000 × 1000 gives 2880 × 480; 600 × 3000 gives 96 × 480). If either is above 20,000 it is
   refused: "picture would exceed the 20,000-unit size limit".
5. When `w` or `h` is above 4,096, the picture is scaled down: its stored pixel size is
   `max(1, round(w × 4096 ÷ L))` × `max(1, round(h × 4096 ÷ L))` with `L = max(w, h)`, drawn
   into a canvas of that size. If any pixel of the result has an alpha value other than 255 it is
   stored as PNG; otherwise as JPEG at quality 0.90. The stored bytes are the canvas's encoding.
   Otherwise the stored bytes are the file's bytes, unchanged, with its signature's type, and the
   pixel size is the original size. The landing size always comes from the original size.
6. Its hash is the SHA-256 digest of the stored bytes.
7. It is refused when adding it would take the board above 250 objects ("250 object limit
   reached"), counting the files already accepted in this import, or when the board's picture
   bytes (storage v3) with this picture and those already accepted in this import counted as
   available would be above 52,428,800 ("pictures would exceed the 50 MiB board limit"). Each
   hash counts once: a picture already counted (available on the board or accepted earlier in
   this import) adds nothing, while a hash on the board whose picture was unavailable adds its
   bytes.
8. Its picture record is written (storage v3, **Importing a picture**). If that fails it is
   refused: "picture could not be stored in this browser". Otherwise it is accepted.

A refused file never enters the board. When the import ends:
- If the open board changed, the tab became read-only, or the page is closing, nothing is added and
  no notice is shown (pictures already written stay until a save removes them).
- The accepted files, if any, are added together as described in **Where images land**, as one
  semantic transaction and one history step. They become the selection, the Select tool is
  armed, any open panel (Board, Objects, Navigation, Information or Templates) closes, and focus
  moves to the canvas.
- When any file was refused, the notice reads "Could not add *names*: *reasons*." where *names*
  are the first three refused files' names in order ("a", "a and b" or "a, b and c"), followed by
  " and *k* more" when *k* more were refused, a file with an empty name being called "Clipboard
  image"; and *reasons* are the distinct refusal reasons of all refused files, in order of first
  appearance, joined by "; ". Valid files in the same import are still added. No dialog is shown.
- Otherwise the notice reads "Added 1 image." or "Added *n* images.".

## Where images land

The accepted images form one **row**, in import order, around a **centre** (the view centre for
the picker and paste, the drop point for a drop). With landing sizes `wᵢ` × `hᵢ`, the row's width
is `W = Σwᵢ + 16 × (n − 1)` and its height `H = max hᵢ`. The first image's left edge is
`centre.x − W ÷ 2`; each next image's left edge is the previous one's plus its width plus 16. Each
image's top is `centre.y + H ÷ 2 − hᵢ`, so the images are bottom-aligned. Each image is then
clamped to the board on its own: `x` becomes `max(−1,000,000, min(x, 1,000,000 − wᵢ))`, and `y`
likewise with `hᵢ`. Example: landing sizes 320 × 480 and 420 × 280 around (100, 40) give the
rectangles (−278, −200, 320, 480) and (58, 0, 420, 280).

Each new image has the empty description, group `null`, and the section that contains its
rectangle's centre, as any new idea (v17). The images are appended at the end of the idea band, in
row order, so they are drawn above every existing idea.

## How an image is drawn

Images draw in the idea band, in array order, like other ideas. An image whose picture is drawn
for it (storage v3: available, decoded to its pixel size, and of the image's pixel size) shows the picture's first frame stretched to
fill its rectangle, edge to edge, with no border or background; transparent pixels show what is
under them. GIFs are drawn still. Otherwise (a **missing picture**) the image draws its rectangle filled `#dedede` with the text "Image
unavailable" centred in it, in the system UI font at 14 units, colour `#5f5b66`, and stays
selectable, movable, resizable, describable and deletable.

**Selected.** A selected image draws a `#518de0` outline 2 CSS pixels wide on its rectangle and
v11's four corner resize handles. It never shows connection dots, side handles or a text editor.

**Accessible names.** Beside the canvas, each image on the board has an element with role `img`
whose accessible name is its whole description, or "No description" when it has none. A board with
no image adds no such element.

## Selecting

With the Select tool a press anywhere on an image's rectangle, transparent pixels included, hits
it; the topmost hit in band order wins, as for ideas. Shift-press, press-and-drag moving and box
selection (v10's intersection rule) work as for any idea.

## Resizing

A corner drag on a selection that holds an image is **proportional**, as Shift makes it for other
ideas (v11), whether Shift is held or not, as v22 says for a selection holding a stroke (both
together resize by one factor). Each image's rectangle is scaled by the selection's factor about
the corner opposite the dragged handle, as v11's proportional resize scales an idea.
- **An image's floor and ceiling:** the factor stops where an image's width or height would be
  below 1 or above 20,000 units; v18's 80-unit width floor does not apply to images. Other selected
  objects keep their own limits; the factor stops at the first limit reached.
- An image never grows past the board's edges.

Objects' size buttons (Wider, Narrower, Taller, Shorter) resize a selection holding an image by the
same rules, as v22 says for strokes: the factor comes from the button's 10-unit step on the named
side, so the image keeps its proportions.

## The context bar

- **One image:** the label "Image", a divider, **Description** (an icon of three lines and the
  word "Description", with `aria-expanded`), then v19's Arrange, Duplicate and Delete.
- **Several images only:** the label "*n* images", then Arrange, Duplicate and Delete.
- **Images with other objects:** today's bar for the other objects; its colour, text, shape,
  stroke and connector controls never change an image (see **Mixed selections**).

No colour, text, shape, stroke or connector control is shown for a selection of images only. The
bar places itself as today; it shows no connection-dot clearance for a selection of images only.

**Description.** Activating Description opens a panel below the bar, as v18's Fill and Border
panels open (the same dark panel, at most `min(340 px, 100vw − 24 px)` wide), with role `group`
and accessible name "Description". It holds the label "Description", a three-row text field named
"Description" holding the image's description, and the count "*c* / 1,000" (*c* the number of code
points). Focus moves to the field. v18's **Menus and panels** rules apply to it with one change:
closing it never discards the draft.
- Typing changes a **draft**. A draft longer than 1,000 code points is cut to its first 1,000;
  one that is not well-formed is not taken.
- The draft is committed when the field loses focus or the panel closes (Description activated
  again, Escape, which returns focus to Description, a press or focus outside the panel, a change of
  selection or the bar hiding), but never while text is being composed: then on composition end.
  Committing changes the image's description as one semantic transaction and one history step; a
  draft equal to the saved description changes nothing and records no step. A draft is never
  applied to another board: when another board opens, it is dropped.
- Description is unavailable while the tab is read-only or busy.

## Objects

Objects' list (v17) gains images, numbered together with the other ideas in reading order. An
image's option reads "image *n*", then " · Group *g*" when it is in a group, then " · " and the
first 36 characters of its description (or "No description"), then " · in *section name*" when it
is in a section, as for a sticky.

For one selected image Objects shows **Description** in place of Content: the label
"Description", the same three-row field with the count "*c* / 1,000 code points", committing as
the panel's field does. It shows no Colour, Text size, Alignment, Formatting, Shape, Fill, Border
or stroke field for images, and keeps the Section field, the move and size buttons, and the order,
Group, Duplicate, Delete, Copy, Cut and Paste commands. With several objects selected Objects shows
today's fields, as **Mixed selections** says.

## Mixed selections

In a selection holding images and other objects, every control acts on the other objects only and
never changes an image. Images are left out when deciding whether Text size, Alignment and
Formatting are shown and available: they show, in Objects and the context bar, exactly when they
would for the selection without its images (so a sticky and an image show them, and Bold makes the
sticky bold and leaves the image unchanged), and v22's rule still hides them while any stroke is
selected. Colour changes the other ideas only. Move, Align, Distribute, Group, the order commands,
Duplicate, Copy, Cut, Delete and Section from selection use every selected image's rectangle as
they use an idea's.

## Connectors and images

An image is never a connector end: Connect is unavailable whenever an image is one of the two
objects, with v19's reason "Select exactly two ideas to connect."; connection dots never show for
an image; a dot drag or a reconnecting end (v23) never takes an image as its target, and dropping
there behaves as a drop on empty canvas.

## Copy, Cut, Paste and Duplicate

Images are copied as ideas are (v14, v17, v19): a copy keeps asset, pixel size, description and
size, with a fresh ID and generation, group and section remapped, at the copy's position, at the
end of the idea band. Copies refer to the same picture: no picture bytes are copied, and copying
images within a board adds no picture bytes. The 250-object limit counts them. In the plain text
Copy and Cut write (v14), images contribute neither text nor a separator. A Paste after which the
board's picture bytes (storage v3) would be above 52,428,800 (images copied from another board in
this tab) is
refused, changes nothing, and the notice reads "Could not paste: the pictures would exceed the
50 MiB board limit.".

## Board files

Save a copy to file (v20) writes board file v2. When the file cannot be written, the notice reads
"Could not save a copy to file: *reason*." with board file v2's writing reason, and nothing is
downloaded. Open board file… (v20) uses board file v2's reasons; a version 2 file's pictures are
all checked and decoded before any question is asked or anything changes, and the new board is
created with its pictures (storage v3). An image whose picture the browser cannot supply is never
written to a file.

## Templates

v21's **board's box** is the box of every object with a rectangle, so it includes images.
Activities hold no images.

## Keyboard route

Everything except dropping can be done from the keyboard: the Image button and Cmd/Ctrl+Shift+K
(the file picker is the browser's), pasting with the platform's paste key, choosing an image in
Objects' list, Description, and the move, size, order, Group, Section from selection, Duplicate,
Delete, Cut, Copy and Paste commands. Dropping files needs a pointer.

## History

v19's history table gains rows, one step each: **Add images** (every image one import adds) and
**Description** (one image). Moving, resizing, grouping, ordering, copying and deleting images are
the existing rows. Steps record each changed image as a whole (its document keys, never picture
bytes). Undo and Redo of any step draw images from the pictures the tab holds (storage v3), also
after a save removed a picture's record.

## Opening older boards

A board saved as document v1 to v9 opens with no images and otherwise exactly as before. Opening
changes nothing; the first Save after an edit writes document v10.

## Verification boundary

Desktop Chrome and Safari as installed. Unit tests cover document v10's checks; storage v3's
records, writing and removal; board file v2's writing and every refusal rule except decoding;
signatures; landing size, scaling arithmetic and the row; the import limits and the notice text;
resize factors with images; the Objects label; copies; the adapter's image values; and that version
1 to 9 boards are unchanged.

Browser checks cover, in Chrome: the Image button, its tooltip, keys and picker; paste through the
paste event and the object-paste keys; drops of one and several files; landing sizes; each format,
a still GIF, a renamed file, refusals and their notice, the size, board and object limits, scaling,
a failed store; moving, proportional resizing and Objects' size buttons; the context bar,
Description and Objects; copies sharing one picture; save, reopen, removal of unused pictures and
Undo after it; a version 9 board, an older application, board files of both versions and damaged
ones; a missing picture; connectors refused; no network request and an unchanged page policy. The
maintainer checks three of these in Safari. v23's remaining rows still describe available
coverage, not automatic gates.
