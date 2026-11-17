# RawBlock Design System

An unapologetic, anti-design system that strips interfaces down to their
structural bones. Thick borders, system-level aesthetics, the raw power of
black-on-white. No rounded corners, no shadows, no polish. Brutalism as a
design language. Every element looks assembled from HTML primitives.

## Colors

- **Black** (#000000): Text, borders, fills
- **White** (#FFFFFF): Background, inverse text
- **Blue** (#0000FF): Links only (hyperlink blue)
- **Surface Base** (#FFFFFF): App background
- **Surface Inverted** (#000000): Inverted sections
- **Surface Sunken** (#F0F0F0): Inputs, disabled fills
- **Success** (#008000): Pure green
- **Warning** (#FFA500): Pure orange
- **Error** (#FF0000): Pure red
- **Info** (#0000FF): Same as link blue
- **Content Primary** (#000000): Primary text
- **Content Secondary** (#3B3B3B): Secondary text
- **Content Tertiary** (#767676): Tertiary text
- **Content Disabled** (#CCCCCC): Disabled borders

## Typography

- **Headline Font**: Archivo Black
- **Body Font**: Work Sans
- **Mono Font**: Space Mono

- **h1**: Archivo Black 40px regular, 1.0 line height
- **h2**: Archivo Black 32px regular, 1.05 line height
- **h3**: Archivo Black 22px regular, 1.1 line height
- **h4**: Work Sans 20px semibold, 1.2 line height
- **body**: Work Sans 16px regular, 1.6 line height
- **small**: Work Sans 14px regular, 1.5 line height
- **tiny**: Work Sans 12px regular, 1.4 line height
- **mono**: Space Mono 15px regular, 1.5 line height
- **Buttons / chips / labels**: Archivo Black 12-14px uppercase, 1-2px tracking

## Spacing

Base unit: 8px. Intentionally irregular — break the scale when it fits.
- **sp-1**: 4px
- **sp-2**: 8px
- **sp-3**: 16px
- **sp-4**: 24px
- **sp-5**: 40px
- **sp-6**: 64px

## Border Radius

- **0px. Every single element. No exceptions.**

## Elevation

**No shadows.** Hierarchy is achieved exclusively through border weight and
scale contrast.
- **border-thin**: 1px
- **border**: 2-3px (default)
- **border-thick**: 3px
- **border-heavy**: 5px

## Components

### Buttons
- **Primary**: black fill, white text, 3px black border, square, 2px tracking,
  uppercase. Hover/active: invert (white fill, black text, 5px border).
- **Secondary**: white fill, black text, 3px black border, square. Hover: invert.
- **Ghost**: transparent, black text, no border, underline. Hover: blue text.
- **Destructive**: #FF0000 fill, white text, 3px black border, square.
- **Disabled**: #F5F5F5 fill, #767676 text, 3px #CCCCCC border.
- **Sizes**: Small 6×16px/12px/32px · Medium 10×24px/14px/44px · Large 16×40px/18px/56px

### Cards
- **Default**: white fill, 3px black border, square, no shadow, sp-4 (24px) padding.
- **Elevated**: white fill, 5px black border (heavier border = more importance), sp-4 padding.

### Inputs
- **Default**: #F0F0F0 fill, #000000 text, 3px black border, square, Space Mono 15px, 10px/12px padding.
- **Hover**: 3px black border, #E8E8E8 fill.
- **Focus**: 5px black border.
- **Error**: 3px #FF0000 border.
- **Disabled**: 3px #CCCCCC border, #F5F5F5 fill.
- **Label**: #000000, Archivo Black 13px uppercase, 4px margin-bottom.
- **Helper text**: Work Sans 12px, 4px margin-top.

### Chips
- **Filter**: white fill, black text, 2px black border, square, 4px/12px,
  uppercase, 10px, 1px tracking. Active: black fill, white text.
- **Status**: square, 2px border. Active #008000 border/text · Warning #FFA500 ·
  Error #FF0000 · Default #000000. 2px/10px, 10px semibold uppercase.

### Lists
- Transparent, Work Sans 16px. 3px black divider. 12px item padding.
- Active: black fill, white text.

### Checkboxes
- 20×20, 3px black border, square. White unchecked, black checked, white checkmark.

### Tooltips
- Black fill, white text, 13px Space Mono, square, no border, no shadow,
  8px/12px, 260px max width.

## Do's and Don'ts

1. **Do** use thick borders (3-5px) as the primary visual organizer.
2. **Don't** round any corners — ever. Sharp edges are non-negotiable.
3. **Do** use full color inversions (black↔white) for hover and active states.
4. **Don't** use opacity for disabled states; use lighter borders and grey fills.
5. **Do** use Archivo Black at large sizes for maximum impact.
6. **Don't** use #0000FF for anything other than hyperlinks; it is reserved.
7. **Do** embrace intentional spacing irregularity.
8. **Do** use uppercase + tracking for buttons and labels.
9. **Don't** add decorative images, icons, or illustrations.
10. **Don't** polish or refine; if it looks too "designed," strip it back further.
