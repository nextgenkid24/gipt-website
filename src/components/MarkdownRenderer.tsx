import React from 'react';
import { parseInlineMarkdown, parseMarkdownBlocks } from '../utils/cmsUtils';

interface MarkdownRendererProps {
  content: string;
  dropCap?: boolean;
}

function renderInline(text: string): React.ReactNode {
  const tokens = parseInlineMarkdown(text);
  return tokens.map((tok, idx) => {
    switch (tok.type) {
      case 'bold':
        return (
          <strong key={idx} className="font-semibold text-[#181F29]">
            {tok.text}
          </strong>
        );
      case 'italic':
        return (
          <em key={idx} className="italic">
            {tok.text}
          </em>
        );
      case 'link': {
        const isExternal = tok.href.startsWith('http');
        return (
          <a
            key={idx}
            href={tok.href}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            className="text-[#008398] underline underline-offset-4 decoration-[#008398]/40 hover:decoration-[#008398] transition-colors"
          >
            {tok.text}
          </a>
        );
      }
      default:
        return <React.Fragment key={idx}>{tok.text}</React.Fragment>;
    }
  });
}

export function MarkdownRenderer({ content, dropCap = false }: MarkdownRendererProps) {
  const blocks = parseMarkdownBlocks(content);
  let firstParagraphSeen = false;

  return (
    <div className="space-y-6 text-[16px] leading-[1.8] text-slate-700">
      {blocks.map((block, idx) => {
        if (block.type === 'h2') {
          return (
            <h2
              key={idx}
              className="font-serif text-2xl sm:text-[28px] font-semibold text-[#181F29] pt-4 pb-1 border-b border-slate-200/80"
            >
              {block.text}
            </h2>
          );
        }
        if (block.type === 'h3') {
          return (
            <h3
              key={idx}
              className="font-serif text-xl font-semibold text-[#181F29] pt-2"
            >
              {block.text}
            </h3>
          );
        }
        if (block.type === 'blockquote') {
          return (
            <blockquote
              key={idx}
              className="my-8 py-6 border-y border-slate-200 text-center sm:text-left"
            >
              <p className="font-serif italic text-xl sm:text-2xl leading-relaxed text-[#181F29]">
                “{block.text}”
              </p>
            </blockquote>
          );
        }
        if (block.type === 'ul') {
          return (
            <ul key={idx} className="space-y-3 pl-5 list-disc marker:text-[#D95316]">
              {block.items.map((item, i) => (
                <li key={i} className="pl-1">
                  {renderInline(item)}
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === 'ol') {
          return (
            <ol key={idx} className="space-y-3 pl-5 list-decimal marker:font-semibold marker:text-[#181F29]">
              {block.items.map((item, i) => (
                <li key={i} className="pl-1">
                  {renderInline(item)}
                </li>
              ))}
            </ol>
          );
        }
        const applyDropCap = dropCap && !firstParagraphSeen;
        firstParagraphSeen = true;
        return (
          <p
            key={idx}
            className={
              applyDropCap
                ? 'first-letter:font-serif first-letter:text-5xl first-letter:font-bold first-letter:text-[#181F29] first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:leading-none'
                : ''
            }
          >
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
