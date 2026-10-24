import { Anchor, Box, Table } from '@mantine/core'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

const MONO = 'var(--mantine-font-family-monospace)'

/**
 * Sem plugin de HTML bruto (nada de `rehype-raw`): o HTML do texto aparece como texto (D15). Links e imagens passam
 * pelo `urlTransform` padrão; o clique é resolvido pela guarda de navegação do main, sem handler aqui.
 */
const components: Components = {
  a: ({ href, children }) => <Anchor href={href}>{children}</Anchor>,
  // A CSP bloqueia imagens remotas: a imagem vira link para a URL, com o texto alternativo ou a própria URL.
  img: ({ src, alt }) => {
    const url = typeof src === 'string' && src !== '' ? src : null
    if (url === null) return <>{alt}</>
    return <Anchor href={url}>{alt || url}</Anchor>
  },
  pre: ({ children }) => (
    <Box
      component="pre"
      p={10}
      bg="var(--mantine-color-body)"
      style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 7, overflowX: 'auto' }}
    >
      {children}
    </Box>
  ),
  code: ({ className, children }) => (
    <code className={className} style={{ fontFamily: MONO, fontSize: 12 }}>
      {children}
    </code>
  ),
  table: ({ children }) => (
    <Box style={{ overflowX: 'auto' }} mb={8}>
      <Table withTableBorder withColumnBorders>
        {children}
      </Table>
    </Box>
  ),
  thead: ({ children }) => <Table.Thead>{children}</Table.Thead>,
  tbody: ({ children }) => <Table.Tbody>{children}</Table.Tbody>,
  tr: ({ children }) => <Table.Tr>{children}</Table.Tr>,
  th: ({ children }) => <Table.Th>{children}</Table.Th>,
  td: ({ children }) => <Table.Td>{children}</Table.Td>
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="buteco-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
}
