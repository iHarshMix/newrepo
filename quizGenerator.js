let op1;
let op2;
let op3;
const no_of_questions = 5;
const operator = ['+', '-', '*', '/'];
const nums = [10, 100];


export async function generateQuestion() {
    let questions = {};
    for (let k = 1; k <= no_of_questions; k++) {
        questions[k.toString()] = await getQuestion();
    }
    
    return questions;
   
}

async function getQuestion(){
    let n1 = Math.floor(Math.random() * 100);
    let n2 = Math.floor(Math.random() * 100);
    let opSelector = operator[Math.floor(Math.random() * 4)];

    if (opSelector == "/") {
        for (let i = 0; i < 200; i++) {
            if (n1 % n2 == 0 && n1 != 0 && n2 != 0 && n2 != 1 && n1 != n2) {
                break;
            }
            n1 = Math.floor(Math.random() * 100);
            n2 = Math.floor(Math.random() * 100);
        }
    }

    if (opSelector == "*") {
        for (let i = 0; i < 100; i++) {
            if (n1 * n2 <= 1000) {
                break;
            }
            n1 = Math.floor(Math.random() * 50);
            n2 = Math.floor(Math.random() * 50);
        }
    }

    let equation = n1 + opSelector + n2 + "= ?"
    let answer = eval(n1 + opSelector + n2);
    let optionArray = await getOptions(answer);
    let question = {
                "equation": equation,
                "solution": answer,
                "option1" : optionArray[0],
                "option2" : optionArray[1],
                "option3" : optionArray[2],
                "option4" : optionArray[3]
    };
    return question;
}


async function getOptions(answer) {
    let myOp = [];
    if (answer > 200) {
        do { 
            op1 = answer + nums[Math.floor(Math.random() * 2)]; 
        }
        while (op1 == answer);

        do { 
            op2 = answer + nums[Math.floor(Math.random() * 2)]; 
        }
        while (op2 == op1);

        op3 = answer + 5;
    }else{
        op1 = answer + 10;
        op2 = answer -10;
        op3 = answer + 5;
    }

    
    myOp.push(answer);
    myOp.push(op1);
    myOp.push(op2);
    myOp.push(op3);
    
    return await shuffle(myOp);
}

async function shuffle(array) {
  let currentIndex = array.length,  randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return await array;
}
