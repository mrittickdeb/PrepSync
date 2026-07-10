import { useState, useCallback, useRef, useEffect } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { Button } from '@/components/ui';
import { clsx } from 'clsx';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { getSocket } from '@/services/socket';
import { YjsSocketProvider } from '@/services/yjsSocketProvider';
import { useAuthStore } from '@/stores/authStore';

interface CodeEditorProps {
  roomId: string;
  onRunCode?: (code: string, language: string) => void;
  isRunning?: boolean;
  output?: string;
  initialCode?: string;
  initialLanguage?: string;
}

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript', id: 63 },
  { value: 'typescript', label: 'TypeScript', id: 74 },
  { value: 'python', label: 'Python', id: 71 },
  { value: 'java', label: 'Java', id: 62 },
  { value: 'cpp', label: 'C++', id: 54 },
  { value: 'c', label: 'C', id: 50 },
  { value: 'go', label: 'Go', id: 60 },
  { value: 'rust', label: 'Rust', id: 73 },
];


// Random bright colors for cursors
const USER_COLORS = ['#30bced', '#6eeb83', '#ffbc42', '#ecd444', '#ee6352', '#9ac2c9', '#8acb88', '#1be7ff'];

export default function CodeEditor({ 
  roomId, 
  onRunCode, 
  isRunning, 
  output,
  initialLanguage = 'javascript',
}: CodeEditorProps) {
  const user = useAuthStore((s) => s.user);
  const [language, setLanguage] = useState(initialLanguage);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<YjsSocketProvider | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);

  // Initialize Yjs and socket provider
  useEffect(() => {
    const doc = new Y.Doc();
    ydocRef.current = doc;

    const socket = getSocket();
    const provider = new YjsSocketProvider(socket, roomId, doc);
    providerRef.current = provider;

    // Set local cursor awareness state
    const myColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
    provider.awareness.setLocalStateField('user', {
      name: user?.name || 'Guest',
      color: myColor,
    });

    // Sync active language via Yjs Map
    const configMap = doc.getMap('config');
    const updateLocalLanguage = () => {
      const syncedLang = configMap.get('language') as string;
      if (syncedLang) {
        setLanguage(syncedLang);
      }
    };
    configMap.observe(updateLocalLanguage);

    return () => {
      if (bindingRef.current) bindingRef.current.destroy();
      provider.destroy();
      doc.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.name]);

  // Dynamically update model language to prevent Monaco model recreation and keep Yjs binding alive
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        monacoRef.current.editor.setModelLanguage(model, language);
      }
    }
  }, [language]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    if (ydocRef.current && providerRef.current) {
      const type = ydocRef.current.getText('monaco');
      const configMap = ydocRef.current.getMap('config');
      
      // Sync current language from shared state
      const syncedLang = configMap.get('language') as string;
      if (syncedLang) {
        setLanguage(syncedLang);
        monaco.editor.setModelLanguage(editor.getModel(), syncedLang);
      }

      const model = editor.getModel();
      if (model) {
        bindingRef.current = new MonacoBinding(
          type,
          model,
          new Set([editor]),
          providerRef.current.awareness
        );
      }
    }

    editor.focus();
  };

  const handleLanguageChange = useCallback((lang: string) => {
    setLanguage(lang);
    if (ydocRef.current) {
      const configMap = ydocRef.current.getMap('config');
      configMap.set('language', lang);
    }
  }, []);

  const handleRun = () => {
    if (onRunCode && editorRef.current) {
      // Pull latest text directly from Monaco
      const currentCode = editorRef.current.getValue();
      onRunCode(currentCode, language);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="h-10 bg-bg-surface border-b border-border-subtle flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="bg-bg-elevated border border-border-subtle rounded px-2 py-1 text-caption font-sans text-text-primary focus:outline-none focus:border-accent"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={handleRun} isLoading={isRunning}>
            ▶ Run
          </Button>
        </div>
      </div>

      {/* Editor + Output split */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Monaco Editor */}
        <div className={clsx('flex-1 min-h-0', output !== undefined && 'h-[70%]')}>
          <Editor
            height="100%"
            language={language}
            onMount={handleEditorMount}
            theme="vs-dark"
            options={{
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              tabSize: 2,
              automaticLayout: true,
              padding: { top: 12 },
              lineNumbers: 'on',
              renderLineHighlight: 'line',
              bracketPairColorization: { enabled: true },
              cursorBlinking: 'smooth',
              smoothScrolling: true,
            }}
          />
        </div>

        {/* Output Console */}
        {output !== undefined && (
          <div className="h-[30%] min-h-[100px] bg-[#1e1e1e] border-t border-border-subtle flex flex-col">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#333]">
              <span className="text-caption text-text-muted font-mono">Output</span>
              {isRunning && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  <span className="text-[10px] text-text-muted font-mono">Running...</span>
                </div>
              )}
            </div>
            <pre className="flex-1 overflow-auto p-3 font-mono text-caption text-[#d4d4d4] whitespace-pre-wrap">
              {output || 'Run your code to see output here.'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
