import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Copy, Check } from 'lucide-react';
import 'highlight.js/styles/github-dark.css'; // 使用深色主题代码高亮

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const handleCopy = (text: string, index: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
        // 自定义代码块渲染，添加复制按钮
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const codeContent = String(children).replace(/\n$/, '');
          const id = Math.random().toString(36).substr(2, 9);

          return !inline && match ? (
            <div className="relative group rounded-lg overflow-hidden my-4">
              <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleCopy(codeContent, id)}
                  className="p-1.5 bg-gray-700/80 hover:bg-gray-600 text-white rounded-md transition-colors"
                  title="复制代码"
                >
                  {copiedIndex === id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="bg-gray-800 text-gray-300 px-4 py-1.5 text-xs font-mono border-b border-gray-700 flex justify-between items-center">
                <span>{match[1]}</span>
              </div>
              <pre className="!my-0 !bg-[#0d1117] !p-4 overflow-x-auto">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            </div>
          ) : (
            <code className={`${className} bg-gray-100 text-red-500 px-1 py-0.5 rounded text-sm font-mono`} {...props}>
              {children}
            </code>
          );
        },
        // 自定义链接渲染
        a({ node, children, ...props }) {
          return (
            <a {...props} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          );
        },
        // 自定义列表渲染
        ul({ node, children, ...props }) {
          return <ul {...props} className="list-disc list-inside my-2 space-y-1">{children}</ul>;
        },
        ol({ node, children, ...props }) {
          return <ol {...props} className="list-decimal list-inside my-2 space-y-1">{children}</ol>;
        },
        // 自定义标题渲染
        h1({ node, children, ...props }) {
          return <h1 {...props} className="text-2xl font-bold my-4 pb-2 border-b border-gray-200">{children}</h1>;
        },
        h2({ node, children, ...props }) {
          return <h2 {...props} className="text-xl font-bold my-3">{children}</h2>;
        },
        h3({ node, children, ...props }) {
          return <h3 {...props} className="text-lg font-bold my-2">{children}</h3>;
        },
        p({ node, children, ...props }) {
          return <p {...props} className="my-2 leading-relaxed">{children}</p>;
        },
        blockquote({ node, children, ...props }) {
          return <blockquote {...props} className="border-l-4 border-gray-300 pl-4 py-1 my-2 text-gray-600 italic bg-gray-50 rounded-r">{children}</blockquote>;
        },
        table({ node, children, ...props }) {
          return <div className="overflow-x-auto my-4"><table {...props} className="min-w-full divide-y divide-gray-200 border">{children}</table></div>;
        },
        th({ node, children, ...props }) {
          return <th {...props} className="px-3 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">{children}</th>;
        },
        td({ node, children, ...props }) {
          return <td {...props} className="px-3 py-2 whitespace-nowrap text-sm border-b">{children}</td>;
        }
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
