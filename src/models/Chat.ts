import mongoose from "mongoose";
import {randomUUID} from 'crypto'
const ChatSchema = new mongoose.Schema({
    id: {type: String, required: true , default:randomUUID()},
    userId: {type: String, required: true},  
    role: {type: String, required: true},
    content: {type: String, required: true},  
}) 

export default mongoose.model("Chat", ChatSchema);