import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';

// Define the structure of a single task
interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export default function TodoApp() {
  const [task, setTask] = useState<string>('');
  const [tasksList, setTasksList] = useState<Task[]>([]);

  // Function to add a new task
  const handleAddTask = () => {
    if (task.trim() === '') return;
    setTasksList([
      ...tasksList, 
      { id: Date.now().toString(), text: task, completed: false }
    ]);
    setTask(''); // Clear input
  };

  // Function to toggle task completion
  const toggleTaskCompletion = (id: string) => {
    setTasksList(
      tasksList.map(item => 
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  // Function to delete a task
  const deleteTask = (id: string) => {
    setTasksList(tasksList.filter(item => item.id !== id));
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Text style={styles.title}>My Tasks</Text>

      {/* List of Tasks */}
      <FlatList
        data={tasksList}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.taskContainer}>
            <TouchableOpacity 
              style={styles.taskTextWrapper} 
              onPress={() => toggleTaskCompletion(item.id)}
            >
              <View style={[styles.checkbox, item.completed && styles.checkedBox]} />
              <Text style={[styles.taskText, item.completed && styles.completedText]}>
                {item.text}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => deleteTask(item.id)}>
              <Text style={styles.deleteButton}>❌</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No tasks yet. Add one below!</Text>
        }
      />

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a new task..."
          placeholderTextColor="#888"
          value={task}
          onChangeText={(text) => setTask(text)}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddTask}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  listContainer: {
    paddingHorizontal: 20,
  },
  taskContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  taskTextWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#007AFF',
    marginRight: 12,
  },
  checkedBox: {
    backgroundColor: '#007AFF',
  },
  taskText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#aaa',
  },
  deleteButton: {
    fontSize: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 40,
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#f1f3f5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  addButton: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
    width: 48,
    borderRadius: 8,
    marginLeft: 12,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
});