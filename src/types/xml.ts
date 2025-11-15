export interface XmlNode {
  type?: 'element' | 'text'
  name?: string
  attributes?: Record<string, string>
  elements?: XmlNode[]
  text?: string
}
