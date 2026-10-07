/** Notices passed to the quiz editor in the URL after the quiz is created. */
export const EDITOR_NOTICE = {
  /** The cover could not be uploaded (network or storage error). */
  COVER_FAILED: 'cover-upload-failed',
  /** The cover was refused by the account's image limits. */
  COVER_REFUSED: 'cover-refused',
} as const;
export type EditorNotice = (typeof EDITOR_NOTICE)[keyof typeof EDITOR_NOTICE];

/** What the editor shows for each notice. */
export const EDITOR_NOTICE_TEXT: Record<EditorNotice, string> = {
  [EDITOR_NOTICE.COVER_FAILED]:
    'The quiz was saved, but its cover image could not be uploaded. Please add it again.',
  [EDITOR_NOTICE.COVER_REFUSED]:
    'The quiz was saved without its cover: your image limits were reached (storage or daily uploads). Remove an image from a quiz, or try again later.',
};

/** A notice from the URL, if it is one the editor knows. */
export const editorNotice = (value: string | undefined) =>
  (Object.values(EDITOR_NOTICE) as string[]).includes(value ?? '')
    ? (value as EditorNotice)
    : undefined;
