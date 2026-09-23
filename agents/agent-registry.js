export const agents={
  planner:{tools:['repo_read','model']},
  coder:{tools:['file_read','file_write','terminal','model']},
  website_engineer:{tools:['repo_read','file_read','file_write','terminal','model','build','test','export']},
  android_build_engineer:{tools:['repo_read','file_read','file_write','terminal','model','build','test','android_build','export']},
  cyber_security_engineer:{tools:['repo_read','file_read','file_write','terminal','model','security_scan','build','test']},
  tester:{tools:['terminal','repo_read','test']},
  builder:{tools:['terminal','repo_read','build','android_build']},
  deployer:{tools:['terminal','deployment']}
};
export function canUse(agent,tool){return !!agents[agent]?.tools.includes(tool);}
