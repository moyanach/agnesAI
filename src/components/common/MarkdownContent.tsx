import React from "react";
import { marked } from "marked";

interface Props {
  content: string;
  className?: string;
}

export const MarkdownContent: React.FC<Props> = ({ content, className = "" }) => {
  const getHtml = () => {
    try {
      return { 
        __html: marked.parse(content, { 
          breaks: true, 
          gfm: true 
        }) as string 
      };
    } catch (e) {
      console.error("Failed to parse markdown:", e);
      return { __html: content };
    }
  };

  return (
    <div 
      className={`markdown-body ${className} text-[var(--text-secondary)]`}
      dangerouslySetInnerHTML={getHtml()} 
    />
  );
};

export default MarkdownContent;
