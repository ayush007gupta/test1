const PriorityQueue = require('priorityqueuejs');
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var cors = require('cors')
app.use(cors())


app.use(express.json());
app.use(express.json({
    type: ['application/json', 'text/plain']
}))

const agent_conversation=new Map();
const customer_conversation=new Map()
const agent_customer=new Map();
const customer_agent=new Map();
const otp_details=new Map();
let otp=999;

// agent_customer.set(1111,[{second:1234,from:1111,to:1234,msg:"this is me"},{second:1235,from:1235,to:1111,msg:"this is me"}]);
// agent_conversation.set(1111,[{
//     userid:'1234'}]);
// const all=agent_conversation.get(1111);
// all.push({userid:'1235'});
// agent_conversation.set(1111,all);


// generate here otp
app.post('/check_service',(req,res)=>{
    console.log(req.body);
    let summary=req.body.summary;
    let tone=req.body.tone;
    let number=req.body.number;
    otp++;                                       // otp generate here
    // twilio
   // sendOTP(otp,number);
    otp_details.set(String(otp),{summary,tone,number});
    
    res.send({
        link:'http://localhost:3000/otp',
        otp:otp,
    })
})



app.post('/verify_otp',(req,res)=>{
     let userOTP=req.body.info.otp;
     let usernumber=req.body.info.number;
     if(otp_details.has(userOTP)){
          const temp=otp_details.get(userOTP);
          console.log('inside ',temp);
          if(temp.number==usernumber)
            res.send({valid:'valid'});
          else
            res.send({valid:'invalid'});
      }
    else
       res.send({valid:'invalid'}); 
});

app.post('/getdetails',(req,res)=>{
   const user=req.body.pair.user1;
   if(user){
     console.log('inside get details') 
     const ans=otp_details.get(user);
     console.log(ans);
      if(ans)
        res.send([ans]);
      else 
        res.send([]);  
   }
   else 
    res.send([]);
})


// conversation
app.get('/conversationagent',(req,res)=>{
    const obj=(req.query.id);
    //console.log('conversationagent',req.query);
    const ans=agent_conversation.get(obj);
    console.log(ans);
    if(ans)
     res.send(ans);
    else
     res.send([]); 
})
app.get('/conversationcustomer',(req,res)=>{
    //console.log('consversation request');
    const obj=req.query.id;
    console.log('conversationcustomer',req.query);
    const ans=customer_conversation.get(obj);
    console.log(ans); 
    if(ans)
     res.send(ans);
    else
     res.send([]); 
})


app.post('/customernewmessage',(req,res)=>{
     const obj=req.body.message;
     const arr1=customer_agent.get(obj.from);
     const arr2=agent_customer.get(obj.to);
     if(!arr1)
        res.send([]); 
     
     arr1.push({
        second:obj.to,
        from:obj.from,
        to:obj.to,
        msg:obj.msg,
      })
      arr2.push({
        second:obj.from,
        from:obj.from,
        to:obj.to,
        msg:obj.msg,
      })
     res.send(arr1);
 });
 app.post('/agentnewmessage',(req,res)=>{
    const obj=req.body.message;
    const arr1=agent_customer.get(obj.from);
    const arr2=customer_agent.get(obj.to);
    if(!arr1)
       res.send([]); 
    
    arr1.push({
       second:obj.to,
       from:obj.from,
       to:obj.to,
       msg:obj.msg,
     })
     arr2.push({
       second:obj.from,
       from:obj.from,
       to:obj.to,
       msg:obj.msg,
     })
    res.send(arr1);
});

app.post('/agentmessage',(req,res)=>{
    const obj=req.body.pair;
    console.log(obj);
    const arr=agent_customer.get(obj.user1);
    if(!arr)
        res.send([]);
    else{
         const ans=arr.filter((e)=> e.second==obj.user2);
         res.send(ans);
      }
})
app.post('/customermessage',(req,res)=>{
    const obj=req.body.pair;
    const arr=customer_agent.get(obj.user1);
    if(!arr)
      res.send([]);
    else{
       const ans=arr.filter((e)=> e.second==obj.user2)
       res.send(ans);
    }
})
// all routes end here



const client_socket=new Map();
const agent_socket=new Map();  
const socket_id=new Map();
//class and constructor for priority_queue
class Customer_support {
     load;
     id;
     name;
   constructor(initialload, userid,tname) {
       this.load = initialload;
       this.id = userid;
       this.name=tname;
   }
}
// cutomersupport queue
const customersupport_queue = new PriorityQueue(function (c1, c2) {
    return c1.load > c2.load;
});
// 
class Customer {
    id
    name
    tone;
    score;
    constructor(rid,rtone,rscore,tname) {
        this.id = rid;
        this.tone=rtone;
        this.score=rscore;
        this.name=tname;
    }
}
const customer_queue = new PriorityQueue(function (c1, c2) {
    return c1.score < c2.score;
});

io.on('connection', (socket) => {
      
      socket.on('support_connect',(id,name)=>{
          console.log('customer Support',name);                                         // console.log('support_connect ',id,typeof(id));
          agent_socket.set(id,socket);    // for storing the user->socket
          agent_customer.set(id,[]);      // for storing the user->customer message
          agent_conversation.set(id,[]);  // for storing the conversations b/w user->customerid
          socket_id.set(socket,id);

           let iload=10;               // initial load of the support agent
           // if some customer waiting in the queue
           while(iload>0&&customer_queue.size()>0){
             let customer=customer_queue.peek()
             customer_queue.deq();
             iload-=customer.tone;
             
             customer_conversation.set(customer.id,[{
               type:'agent', 
               name:name,
               userid:id,
             }])   //  pushing in the client conversation
             
             let arr=agent_conversation.get(id);
             arr.push({type:'customer',name:'default',userid:customer.id})
             agent_conversation.set(id,arr);    // psuhing inthe support agent conversation
             console.log('inside support connect',customer);
             console.log(client_socket);
             let customer_socket=client_socket.get(customer.id);
             socket.to(customer_socket.id).emit('trigger','');
             customer_socket.to(socket.id).emit('trigger','');
            }

           // if load is still greater than zero 
           if(iload>0){
             customersupport_queue.enq(new Customer_support(iload,id,name));
           }
      });       
      

      socket.on('client_connect',(id,name)=>
      {
             // console.log('inside client connect'); 
              client_socket.set(id,socket);
              customer_agent.set(id,[]); 
              customer_conversation.set(id,[]);
              let details=otp_details.get(id);
              let tonescore=3   // initially score is taken as 2
              if(customersupport_queue.size()>0)
                {
                
                  let customer_support = customersupport_queue.peek();
                   customersupport_queue.deq();
                   console.log(customer_support); 
                   let load=customer_support.load;
                   load-=tonescore;               // subtract the score of customer tone of the 
                
                   if(load>0)
                     customersupport_queue.enq(new Customer_support(load,customer_support.id,customer_support.name));
                   console.log('inside client connect'); 
                   console.log(customer_support);
                   customer_conversation.set(id,[{
                        type:'agent', 
                        userid:customer_support.id,
                        name:customer_support.name,
                   }])
                   let arr=agent_conversation.get(customer_support.id);
                   arr.push({type:'customer',userid:id,name:name})
                   agent_conversation.set(customer_support.id,arr);
                 
                   let agentsocket=agent_socket.get(customer_support.id);
                   socket.to(agentsocket.id).emit('trigger','');
                   agentsocket.to(socket.id).emit('trigger','');
               }
              else{
                console.log('this client is in queue');
                let date = new Date();
                let hour = date.getHours();
                let minutes = date.getMinutes();
                let sec = date.getSeconds();
                let score =1000 * hour + 100 * minutes + 10 * sec-100*tonescore;

                customer_queue.enq(new Customer(id,tonescore,score,name));

              } 
           })
       //
        socket.on('client_msg',(data)=>{
           console.log('inside client_msg',data);
           let recieverid=data.to;
           let recieversocket=agent_socket.get(recieverid);
          // console.log(agent_socket);
           socket.to(recieversocket.id).emit('message',data);
      })
      //
      socket.on('agent_msg',(data)=>{
        console.log('agent_msg',data);
        let recieverid=data.to;
        let recieversocket=client_socket.get(recieverid);
        console.log(client_socket);
        socket.to(recieversocket.id).emit('message',data);
      });

      socket.on('disconnect', () => {
             console.log('somebody left');
             if(socket_id.has(socket)){
               console.log('some support team left');
               let id=socket_id.get(socket);
               agent_conversation.delete(id);
               agent_customer.delete(id);
               agent_socket.delete(id);
               socket_id.delete(socket);             
             } 

       }); 
 
})

server.listen(process.env.PORT || 4200, () => {
    console.log('server created on port 4200');
})