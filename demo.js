const map=new Map();
let obj={te:'yash'};
map.set(obj,[1,2,3]);
//map.set({te:"yash"},[233])

let arr=map.get(obj);

if(map.has(obj))
 {
     console.log('asf'); 
    console.log(map);
    console.log(arr);
}



