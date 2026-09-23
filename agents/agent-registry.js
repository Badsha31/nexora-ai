export const agents={planner:{tools:['repo_read','model']},coder:{tools:['file_read','file_write','terminal','model']},tester:{tools:['terminal','repo_read']},builder:{tools:['terminal','repo_read']},deployer:{tools:['terminal','deployment']}};
export function canUse(agent,tool){return !!agents[agent]?.tools.includes(tool);}
