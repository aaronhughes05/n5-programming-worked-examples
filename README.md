# Interactive Subgoal-Labelled Worked Examples  
## National 5 Computing Science Programming

This project provides an interactive learning resource for **National 5 Computing Science** programmig (all resources will be based on the _Qualifications Scotland_ course specification). The website supports learners in developing programming problem-solving skills through structured worked examples and guided activities.

The resource helps learners move from **problem description to program solution** using clear stages of analysis, design, implementation, and testing.

The website is designed for use in classroom environments and on school computers with restricted software access.

---

## Project Aim

The aim of this project is to support National 5 programming learners who struggle to:

- Translate problem descriptions into algorithms
- Plan programs before coding
- Understand loops and algorithms
- Structure solutions logically

The resource models expert problem solving and provides structured activities to support understanding.

---

## Target Learners

This resource is designed for:

- National 5 Computing Science students  
- Ages 15–16  
- Beginner programmers

Expected prior knowledge:

- Variables
- Basic input and output
- Simple arithmetic

---

## Artefact Overview

The website contains **three interactive worked examples** based on core National 5 programming algorithms:

1. **Input Validation**
2. **Running Totals**
3. **Array Traversal**

Each example focuses on a key programming concept required in the National 5 course.

---

## Learning Structure

Each example follows the same structured sequence:

### 1. Problem

Learners are presented with a realistic programming problem.

### 2. Predict

Learners think about the solution before seeing the program.

Typical questions include:

- What inputs are required?
- What outputs are required?
- What programming constructs might be needed?

### 3. Worked Example

The complete solution is presented using structured problem solving:

- Analysis (Inputs, Processes, Outputs)
- Algorithm design
- Subgoal breakdown
- Step-by-step code
- Final program

### 4. Parsons Puzzle

Learners reorder program lines into the correct sequence.

This helps learners focus on program logic without needing to write full code.

### 5. Code Understanding Activities

Learners answer questions about program structure such as:

- Which lines run inside the loop
- What each variable stores
- How the program behaves

These activities help learners explain how programs work.

### 6. Modify Task

Learners modify the program to solve a related problem.

This encourages independent problem solving.

### 7. Testing

Example test cases are provided to demonstrate correct program behaviour.

### 8. Reflection

Learners explain the reasoning behind the program.

Example questions include:

- Why is a loop needed?
- What happens if the input is invalid?
- How does the program ensure correctness?

---

## Website Structure


```
/frontend
    index.html
    /pages
        example1.html
        example2.html
        example3.html
    /css
        styles.css
    /js
        script.js
```


### Pages

**Home Page**

- Introduction
- Instructions
- Navigation

**Example Pages**

- Example 1 – Input Validation
- Example 2 – Running Total
- Example 3 – Array Traversal

---

## Technologies Used

This project uses simple web technologies to ensure compatibility with school computers.

- HTML
- CSS
- JavaScript
- GitHub Pages

No external libraries or frameworks are required.

---

## Running the Website Locally

Clone the repository:

`git clone https://github.com/aaronhughes05/n5-programming-worked-examples.git`

Open the website by opening:

`frontend/index.html`

in a web browser.

---

## Deployment

The website is deployed using **GitHub Pages**.

The site is served from the `/frontend` directory.

---

## Development Workflow

### Before working

Pull the latest version:

```
git pull
```

### After making changes

Commit and push:

```
git add .
git commit -m "Describe changes"
git push
```

---

## Contributors

This project was developed as part of the **Computing Science Education Theory and Practice** course.

Contributors:

- Aaron Hughes
- Varshini Seshan
- Sophie MacLurg
- Rabindranath Jha

---

## Future Development

Possible extensions include:

- Additional programming examples
- More interactive activities
- Automated feedback
- Additional National 5 topics

---

## License

This project is for educational use.
