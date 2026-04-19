# TODO - Wincare24 UI + API Integration

## Approved Plan
- [x] Read old files from `../Wincare24`.
- [x] Confirm integration plan with user.

## Implementation Steps
- [ ] Replace `index.html` in current project with old `wincare24/index.html` (keep UI 100%).
- [ ] Update `script.js`:
  - [ ] Replace localStorage init with `fetch('/api/repairs')`.
  - [ ] Map API fields to UI fields:
    - [ ] `customer -> tenKhach`
    - [ ] `device -> tenMay`
    - [ ] `status -> tinhTrang`
    - [ ] `note -> ghiChu`
  - [ ] Keep search/filter/expand/print/modal features.
  - [ ] Keep create form submit but POST to `/api/repairs`.
  - [ ] Refetch list after successful POST.
- [ ] Keep `style.css` unchanged.
- [ ] Final review.

## Testing (pending user preference)
- [ ] API GET `/api/repairs` response shape check.
- [ ] Create form POST and table refresh.
- [ ] Search + filter + responsive.
