export class NexoraError extends Error { constructor(code,message,status=400,details={}){super(message);this.code=code;this.status=status;this.details=details;} }
export const err=(code,message,status=400,details={})=>new NexoraError(code,message,status,details);
export const result=(success,data=null,error=null)=>success?{success:true,data}:{success:false,error};
