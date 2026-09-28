'use client';
import Markdown from 'react-markdown';
export default function MarkdownPreview({ text }: { text: string }) {
  return (
    <div className="space-y-space-sm break-words text-body text-text-primary [&_a]:text-accent [&_a]:underline [&_blockquote]:border-l [&_blockquote]:border-accent [&_blockquote]:pl-space-sm [&_code]:rounded-sm [&_code]:bg-surface-low [&_code]:px-badge-y [&_h1]:text-section-heading [&_h2]:text-card-title [&_h3]:text-label [&_li]:ml-space-md [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-control [&_pre]:bg-surface-low [&_pre]:p-space-sm [&_ul]:list-disc">
      <Markdown
        skipHtml
        disallowedElements={['img']}
        components={{
          a: (props) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
