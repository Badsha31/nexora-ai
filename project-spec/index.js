export function normalizeProjectSpec(input={}){
  const type=String(input.type||'website').toLowerCase();
  const allowedTypes=new Set(['website','android','cyber']);
  return {
    type:allowedTypes.has(type)?type:'website',
    frontend:String(input.frontend||'auto').trim()||'auto',
    backend:String(input.backend||'auto').trim()||'auto',
    database:String(input.database||'auto').trim()||'auto',
    designReference:String(input.designReference||'').trim(),
    requirements:String(input.requirements||'').trim()
  };
}
export function buildBrief(project,spec){
  return {name:project.name,type:spec.type,frontend:spec.frontend,backend:spec.backend,database:spec.database,designReference:spec.designReference||null,requirements:spec.requirements||'',rules:[
    'Build a complete runnable production-oriented project, not a mockup.',
    'Match the supplied design reference closely when one is provided: layout, spacing, typography, visual hierarchy, responsive behavior and component structure.',
    'Keep the project name and brand identity exactly as requested.',
    'Use the selected stack; if a field is auto, choose a sensible stable stack and document the choice in project memory.',
    'Do not invent successful builds, tests or deployments; verify them with platform tools.',
    'Never commit secrets, private keys or environment files.'
  ]};
}
